import { db } from './db/index.js';
import { withPostgresTransaction, hasDirectDatabaseConnection } from './db/postgres.js';

const CONFIRMATION_PHRASE = 'RESET IMPORTED DATA AND FINANCIALS';

type MaintenanceResetStepErrorInput = {
  step: string;
  table?: string;
  message: string;
  code?: string | null;
};

export class MaintenanceResetStepError extends Error {
  step: string;
  table?: string;
  code?: string | null;

  constructor(input: MaintenanceResetStepErrorInput) {
    super(input.message);
    this.name = 'MaintenanceResetStepError';
    this.step = input.step;
    this.table = input.table;
    this.code = input.code || null;
  }
}

type TableQueryResult = {
  rows: Array<Record<string, unknown>>;
  skipped: boolean;
  reason?: 'table_not_found' | 'column_not_found';
};

type DeleteResult = {
  deleted: number;
  skipped: boolean;
  reason?: 'table_not_found' | 'column_not_found';
};

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

const isMissingTableOrColumnError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === '42p01' ||
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('column') && message.includes('does not exist') ||
    message.includes('relation') && message.includes('does not exist')
  );
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

const fetchRowsSafe = async (
  table: string,
  filters: Array<[string, string, unknown]> = [],
): Promise<TableQueryResult> => {
  try {
    const rows = await fetchRows(table, filters);
    return { rows, skipped: false };
  } catch (error: any) {
    if (isMissingTableOrColumnError(error)) {
      return {
        rows: [],
        skipped: true,
        reason: String(error?.code || '').toLowerCase() === '42703' ? 'column_not_found' : 'table_not_found',
      };
    }
    throw error;
  }
};

const deleteRowsByIds = async (table: string, ids: Array<string | number>) => {
  if (ids.length === 0) {
    return 0;
  }

  let query = db.from(table).delete();
  query = query.in('id', ids as never[]);
  const selected = query.select('id') as unknown as {
    then?: PromiseLike<{ error: unknown }>['then'];
    maybeSingle?: () => Promise<{ error: unknown }>;
    single?: () => Promise<{ error: unknown }>;
  };

  if (typeof selected.then === 'function') {
    const { error } = await (selected as PromiseLike<{ error: unknown }>);
    if (error) {
      throw error;
    }
    return ids.length;
  }

  if (typeof selected.maybeSingle === 'function') {
    const { error } = await selected.maybeSingle();
    if (error) {
      throw error;
    }
    return ids.length;
  }

  if (typeof selected.single === 'function') {
    const { error } = await selected.single();
    if (error) {
      throw error;
    }
    return ids.length;
  }

  throw new Error(`Unsupported delete query shape for ${table}`);
};

const deleteRowsByFilter = async (
  table: string,
  filters: Array<[string, string, unknown]> = [],
): Promise<DeleteResult> => {
  try {
    const rows = await fetchRows(table, filters);
    const deleted = await deleteRowsByIds(
      table,
      rows.map((row) => String(row.id)),
    );
    return { deleted, skipped: false };
  } catch (error: any) {
    if (isMissingTableOrColumnError(error)) {
      return {
        deleted: 0,
        skipped: true,
        reason: String(error?.code || '').toLowerCase() === '42703' ? 'column_not_found' : 'table_not_found',
      };
    }
    throw error;
  }
};

const getImportedApplicationIds = async () => {
  const { data, error } = await db.from('applications').select('id').not('legacy_id', 'is', null);
  if (error) {
    if (isMissingTableOrColumnError(error)) {
      return { ids: [] as string[], skipped: true, reason: 'column_not_found' as const };
    }
    throw error;
  }
  return { ids: (data || []).map((row: any) => String(row.id)), skipped: false as const };
};

const getImportedRentalIds = async (applicationIds: string[]) => {
  const ids = new Set<string>();

  const legacyQuery = db.from('rentals').select('id').not('legacy_application_id', 'is', null);
  const { data: legacyRows, error: legacyError } = await legacyQuery;
  if (legacyError) {
    if (!isMissingTableOrColumnError(legacyError)) throw legacyError;
    return { ids: [], skipped: true as const, reason: String(legacyError?.code || '').toLowerCase() === '42703' ? 'column_not_found' as const : 'table_not_found' as const };
  }
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

  return { ids: Array.from(ids), skipped: false as const };
};

const getImportedCustomers = async (applicationIds: string[], rentalIds: string[]) => {
  const direct = await fetchRowsSafe('customers', [['source', 'eq', 'legacy-import']]);
  const rows = [...direct.rows];
  const ids = new Set<string>(rows.map((row) => String(row.id)));

  if (applicationIds.length > 0) {
    const linkedByApplications = await fetchRowsSafe('customers', [['application_id', 'in', applicationIds]]);
    for (const row of linkedByApplications.rows) {
      ids.add(String(row.id));
      rows.push(row);
    }
  }

  if (rentalIds.length > 0) {
    const linkedByRentals = await fetchRowsSafe('customers', [['rental_id', 'in', rentalIds]]);
    for (const row of linkedByRentals.rows) {
      ids.add(String(row.id));
      rows.push(row);
    }
  }

  return {
    rows: Array.from(new Map(rows.map((row) => [String(row.id), row])).values()),
    skipped: direct.skipped,
    reason: direct.reason,
  };
};

const getImportedInvoices = async () => {
  const direct = await fetchRowsSafe('invoices', [['source', 'eq', 'legacy-import']]);
  return direct;
};

const optionalInvoiceChildTables = ['invoice_line_items', 'invoice_items', 'payments', 'financial_transactions'] as const;

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
  const applicationResult = await getImportedApplicationIds();
  const rentalResult = await getImportedRentalIds(applicationResult.ids);
  const customersResult = await getImportedCustomers(applicationResult.ids, rentalResult.ids);
  const invoicesResult = await getImportedInvoices();
  const manualInvoicesResult = await fetchRowsSafe('manual_invoices');
  const manualInvoiceItemsResult = await fetchRowsSafe('manual_invoice_items');
  const stripeWebhookEvents = await countRows('stripe_webhook_events');

  const applicationIds = applicationResult.ids;
  const rentalIds = rentalResult.ids;
  const customers = customersResult.rows;
  const invoices = invoicesResult.rows;
  const manualInvoices = manualInvoicesResult.rows;
  const manualInvoiceItems = manualInvoiceItemsResult.rows;

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
      applications: applicationIds.length ? await fetchRows('applications', [['legacy_id', 'not.is', null]]) : [],
      customers,
      rentals: rentalIds.length ? await fetchRows('rentals', [['id', 'in', rentalIds]]) : [],
      invoices,
      manualInvoices,
      manualInvoiceItems,
    },
    skipped: {
      applications: applicationResult.skipped,
      rentals: rentalResult.skipped,
      customers: customersResult.skipped,
      invoices: invoicesResult.skipped,
      manualInvoices: manualInvoicesResult.skipped,
      manualInvoiceItems: manualInvoiceItemsResult.skipped,
    },
  };
};

export const resetImportedDataAndFinancials = async () => {
  const plan = await getImportedDataResetPlan();
  const performStep = async (step: string, table: string, ids: Array<string | number>) => {
    try {
      return await deleteRowsByIds(table, ids);
    } catch (error: any) {
      throw new MaintenanceResetStepError({
        step,
        table,
        message: `Reset failed while deleting ${step.replace(/^delete_/, '').replace(/_/g, ' ')} rows.`,
        code: String(error?.code || error?.name || null),
      });
    }
  };

  const performOptionalTableDelete = async (
    step: string,
    table: string,
    filters: Array<[string, string, unknown]>,
  ) => {
    try {
      return await deleteRowsByFilter(table, filters);
    } catch (error: any) {
      throw new MaintenanceResetStepError({
        step,
        table,
        message: `Reset failed while deleting ${table} rows.`,
        code: String(error?.code || error?.name || null),
      });
    }
  };

  const performDeletes = async () => {
    const deletedManualInvoiceItems = await performStep(
      'delete_manual_invoice_items',
      'manual_invoice_items',
      plan.rows.manualInvoiceItems.map((row) => String(row.id)),
    );
    const deletedManualInvoices = await performStep(
      'delete_manual_invoices',
      'manual_invoices',
      plan.rows.manualInvoices.map((row) => String(row.id)),
    );
    const optionalInvoiceDependencies = [];
    for (const table of optionalInvoiceChildTables) {
      const result = await performOptionalTableDelete(
        `delete_${table}`,
        table,
        [['invoice_id', 'in', plan.rows.invoices.map((row) => String(row.id))]],
      );
      optionalInvoiceDependencies.push({ table, ...result });
    }
    const deletedInvoices = await performStep(
      'delete_invoices',
      'invoices',
      plan.rows.invoices.map((row) => String(row.id)),
    );
    const deletedRentals = await performStep(
      'delete_rentals',
      'rentals',
      plan.rows.rentals.map((row) => String(row.id)),
    );
    const deletedApplications = await performStep(
      'delete_applications',
      'applications',
      plan.rows.applications.map((row) => String(row.id)),
    );

    const customersToDelete = plan.rows.customers
      .filter((row) => String((row as any).source || '') === 'legacy-import')
      .filter((row) => {
        const customer = row as Record<string, unknown>;
        const applicationId = customer.application_id == null ? null : String(customer.application_id);
        const rentalId = customer.rental_id == null ? null : String(customer.rental_id);
        return (
          (!applicationId || plan.rows.applications.some((application) => String(application.id) === applicationId)) ||
          (!rentalId || plan.rows.rentals.some((rental) => String(rental.id) === rentalId))
        );
      });
    const deletedCustomers = await performStep(
      'delete_customers',
      'customers',
      customersToDelete.map((row) => String(row.id)),
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
      preservedCustomers: plan.rows.customers.length - customersToDelete.length,
      skippedInvoiceDependencies: optionalInvoiceDependencies.filter((dependency) => dependency.skipped),
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
