import { db } from './db/index.js';
import { withPostgresTransaction, hasDirectDatabaseConnection } from './db/postgres.js';

const CONFIRMATION_PHRASE = 'RESET IMPORTED DATA AND FINANCIALS';

export type ResetCounts = {
  applications: number;
  customers: number;
  rentals: number;
  invoices: number;
  manualInvoices: number;
  manualInvoiceItems: number;
  financialRows: number;
  stripeWebhookEvents: number;
};

export type ResetCriteria = {
  applications: string;
  customers: string;
  rentals: string;
  financials: string;
};

export type ResetSummary = {
  counts: ResetCounts;
  criteria: ResetCriteria;
  preserved: {
    adminUsers: true;
    cars: true;
    stripeExternalRecords: true;
  };
};

const emptyCounts = (): ResetCounts => ({
  applications: 0,
  customers: 0,
  rentals: 0,
  invoices: 0,
  manualInvoices: 0,
  manualInvoiceItems: 0,
  financialRows: 0,
  stripeWebhookEvents: 0,
});

const countRows = async (table: string, filters: Array<[string, string, unknown]> = []) => {
  let query = db.from(table).select('id', { count: 'exact', head: true });
  for (const [column, op, value] of filters) {
    if (op === 'eq') query = query.eq(column, value as never);
    if (op === 'not.is') query = query.not(column, 'is', value as never);
    if (op === 'in') query = query.in(column, value as never[]);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

const fetchRows = async (table: string, filters: Array<[string, string, unknown]> = []) => {
  let query = db.from(table).select('*');
  for (const [column, op, value] of filters) {
    if (op === 'eq') query = query.eq(column, value as never);
    if (op === 'not.is') query = query.not(column, 'is', value as never);
    if (op === 'in') query = query.in(column, value as never[]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Array<Record<string, unknown>>;
};

const deleteRowsByIds = async (table: string, ids: Array<string | number>) => {
  if (ids.length === 0) {
    return 0;
  }

  let query = db.from(table).delete();
  query = query.in('id', ids as never[]);
  const selected = query.select('id') as unknown as {
    maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
    single?: () => Promise<{ data: unknown; error: unknown }>;
    then?: PromiseLike<{ data: unknown; error: unknown }>['then'];
  };
  if (typeof selected.maybeSingle === 'function') {
    const { error } = await selected.maybeSingle();
    if (error) throw error;
    return ids.length;
  }
  if (typeof selected.single === 'function') {
    const { error } = await selected.single();
    if (error) throw error;
    return ids.length;
  }
  const result = await (selected as PromiseLike<{ data: unknown; error: unknown }>);
  if (result && typeof result === 'object' && 'error' in result && result.error) {
    throw result.error;
  }
    return ids.length;
};

const getImportedApplicationIds = async () => {
  const { data, error } = await db.from('applications').select('id').not('legacy_id', 'is', null);
  if (error) throw error;
  return (data || []).map((row: any) => String(row.id));
};

const getImportedRentalIds = async (applicationIds: string[]) => {
  const ids = new Set<string>();

  const legacyQuery = db.from('rentals').select('id').not('legacy_application_id', 'is', null);
  const { data: legacyRows, error: legacyError } = await legacyQuery;
  if (legacyError) throw legacyError;
  for (const row of legacyRows || []) {
    ids.add(String((row as any).id));
  }

  if (applicationIds.length > 0) {
    const linkedQuery = db.from('rentals').select('id').in('application_id', applicationIds);
    const { data: linkedRows, error: linkedError } = await linkedQuery;
    if (linkedError) throw linkedError;
    for (const row of linkedRows || []) {
      ids.add(String((row as any).id));
    }
  }

  return Array.from(ids);
};

const getImportedCustomers = async () =>
  fetchRows('customers', [['source', 'eq', 'legacy-import']]);

const getImportedInvoices = async () =>
  fetchRows('invoices', [['source', 'eq', 'legacy-import']]);

export const buildResetSummary = (counts: ResetCounts): ResetSummary => ({
  counts,
  criteria: {
    applications: 'legacy_id is not null',
    customers: 'source = legacy-import',
    rentals: 'legacy_application_id is not null or linked to imported applications',
    financials: 'local invoices/manual invoice tables only',
  },
  preserved: {
    adminUsers: true,
    cars: true,
    stripeExternalRecords: true,
  },
});

export const getImportedDataResetPlan = async () => {
  const applicationIds = await getImportedApplicationIds();
  const rentalIds = await getImportedRentalIds(applicationIds);
  const customers = await getImportedCustomers();
  const invoices = await getImportedInvoices();
  const manualInvoices = await fetchRows('manual_invoices');
  const manualInvoiceItems = await fetchRows('manual_invoice_items');
  const stripeWebhookEvents = await countRows('stripe_webhook_events');

  if (applicationIds.length === 0 && rentalIds.length === 0 && customers.length === 0 && invoices.length === 0 && manualInvoices.length === 0) {
    throw new Error('No reliable imported markers were found. Refusing to broad-delete data without an imported/legacy marker.');
  }

  const counts = {
    applications: applicationIds.length,
    customers: customers.length,
    rentals: rentalIds.length,
    invoices: invoices.length,
    manualInvoices: manualInvoices.length,
    manualInvoiceItems: manualInvoiceItems.length,
    financialRows: invoices.length + manualInvoices.length + manualInvoiceItems.length,
    stripeWebhookEvents,
  };

  return {
    ...buildResetSummary(counts),
    rows: {
      applications: await fetchRows('applications', [['legacy_id', 'not.is', null]]),
      customers,
      rentals: rentalIds.length ? await fetchRows('rentals', [['id', 'in', rentalIds]]) : [],
      invoices,
      manualInvoices,
      manualInvoiceItems,
    },
  };
};

export const resetImportedDataAndFinancials = async () => {
  const plan = await getImportedDataResetPlan();
  const performDeletes = async () => {
    const deletedManualInvoiceItems = await deleteRowsByIds(
      'manual_invoice_items',
      plan.rows.manualInvoiceItems.map((row) => String(row.id)),
    );
    const deletedManualInvoices = await deleteRowsByIds(
      'manual_invoices',
      plan.rows.manualInvoices.map((row) => String(row.id)),
    );
    const deletedInvoices = await deleteRowsByIds(
      'invoices',
      plan.rows.invoices.map((row) => String(row.id)),
    );
    const deletedRentals = await deleteRowsByIds(
      'rentals',
      plan.rows.rentals.map((row) => String(row.id)),
    );
    const deletedApplications = await deleteRowsByIds(
      'applications',
      plan.rows.applications.map((row) => String(row.id)),
    );
    const deletedCustomers = await deleteRowsByIds(
      'customers',
      plan.rows.customers.map((row) => String(row.id)),
    );
    const deletedStripeWebhookEvents = 0;

    return {
      counts: {
        applications: deletedApplications,
        customers: deletedCustomers,
        rentals: deletedRentals,
        invoices: deletedInvoices,
        manualInvoices: deletedManualInvoices,
        manualInvoiceItems: deletedManualInvoiceItems,
        financialRows: deletedInvoices + deletedManualInvoices + deletedManualInvoiceItems,
        stripeWebhookEvents: deletedStripeWebhookEvents,
      },
    };
  };

  if (hasDirectDatabaseConnection()) {
    return withPostgresTransaction(async () => performDeletes());
  }

  return performDeletes();
};

export const getResetExportPayload = async (adminEmail: string | null) => {
  const plan = await getImportedDataResetPlan();
  return {
    createdAt: new Date().toISOString(),
    createdBy: adminEmail || null,
    confirm: CONFIRMATION_PHRASE,
    criteria: plan.criteria,
    rows: plan.rows,
  };
};
