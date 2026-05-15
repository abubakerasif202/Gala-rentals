import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  applications: [] as Array<Record<string, any>>,
  customers: [] as Array<Record<string, any>>,
  rentals: [] as Array<Record<string, any>>,
  invoices: [] as Array<Record<string, any>>,
  manual_invoices: [] as Array<Record<string, any>>,
  manual_invoice_items: [] as Array<Record<string, any>>,
  invoice_items: [] as Array<Record<string, any>>,
  invoice_line_items: [] as Array<Record<string, any>>,
  payments: [] as Array<Record<string, any>>,
  financial_transactions: [] as Array<Record<string, any>>,
  stripe_webhook_events: [] as Array<Record<string, any>>,
  deleteOrder: [] as string[],
  failOnStep: null as string | null,
  missingTables: new Set<string>(),
}));

const matchesFilter = (row: Record<string, any>, filter: { column: string; op: string; value: unknown }) => {
  if (filter.op === 'eq') return String(row[filter.column]) === String(filter.value);
  if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.some((value) => String(value) === String(row[filter.column]));
  if (filter.op === 'not.is') return row[filter.column] != null;
  return true;
};

vi.mock('../db/index.js', () => ({
  db: {
    from: (table: string) => {
      const state = mockState;
      const query: any = {
        _table: table,
        _action: 'select',
        _selectOptions: undefined as any,
        _filters: [] as Array<{ column: string; op: string; value: unknown }>,
        select(_columns: string, _options?: unknown) {
          query._selectOptions = _options;
          return query;
        },
        eq(column: string, value: unknown) {
          query._filters.push({ column, op: 'eq', value });
          return query;
        },
        in(column: string, value: unknown[]) {
          query._filters.push({ column, op: 'in', value });
          return query;
        },
        not(column: string, op: string, value: unknown) {
          query._filters.push({ column, op: `not.${op}`, value });
          return query;
        },
        delete() {
          query._action = 'delete';
          return query;
        },
        async maybeSingle() {
          const rows = await query;
          return { data: rows.data?.[0] ?? null, error: rows.error ?? null };
        },
        async single() {
          return query.maybeSingle();
        },
        then(onFulfilled: (value: { data: Array<Record<string, any>> | null; error: any }) => unknown) {
          if (state.missingTables.has(table)) {
            return Promise.resolve(
              onFulfilled({ data: null, error: { code: '42P01', message: `relation "${table}" does not exist` } }),
            );
          }
          const rows = (state as any)[table] || [];
          const filtered = rows.filter((row: Record<string, any>) => query._filters.every((filter) => matchesFilter(row, filter)));
          if (query._selectOptions && typeof query._selectOptions === 'object' && (query._selectOptions as any).head) {
            return Promise.resolve(onFulfilled({ data: null, error: null, count: filtered.length } as any));
          }
          if (query._action === 'delete') {
            if (state.failOnStep === table) {
              return Promise.resolve(onFulfilled({ data: null, error: { code: '23503', message: 'fk violation' } }));
            }
            if (
              table === 'invoice_line_items' &&
              state.financial_transactions.some((transaction) =>
                filtered.some((row: Record<string, any>) => String(transaction.invoice_line_item_id) === String(row.id)),
              )
            ) {
              return Promise.resolve(onFulfilled({ data: null, error: { code: '23503', message: 'fk violation' } }));
            }
            state.deleteOrder.push(table);
            const remaining = rows.filter((row: Record<string, any>) => !query._filters.every((filter) => matchesFilter(row, filter)));
            (state as any)[table] = remaining;
            return Promise.resolve(onFulfilled({ data: [], error: null }));
          }
          return Promise.resolve(onFulfilled({ data: filtered, error: null }));
        },
      };
      return query;
    },
  },
}));

vi.mock('../db/postgres.js', () => ({
  hasDirectDatabaseConnection: vi.fn(() => false),
  withPostgresTransaction: vi.fn(async (_cb: unknown) => {
    throw new Error('unexpected transaction use');
  }),
}));

import { getImportedDataResetPlan, resetImportedDataAndFinancials } from '../adminMaintenanceReset.js';

describe('adminMaintenanceReset', () => {
  beforeEach(() => {
    mockState.applications = [{ id: 'app-1', legacy_id: 101 }, { id: 'app-2', legacy_id: null }];
    mockState.customers = [
      { id: 'cust-1', source: 'legacy-import', application_id: 'app-1' },
      { id: 'cust-2', source: 'current' },
    ];
    mockState.rentals = [
      { id: 'rent-1', application_id: 'app-1', legacy_application_id: 101 },
      { id: 'rent-2', application_id: 'app-2', legacy_application_id: null },
    ];
    mockState.invoices = [{ id: 'inv-1', source: 'legacy-import' }, { id: 'inv-2', source: 'current' }];
    mockState.manual_invoices = [{ id: 'm-1' }];
    mockState.manual_invoice_items = [{ id: 'mi-1', invoice_id: 'm-1' }];
    mockState.invoice_items = [{ id: 'ii-1', invoice_id: 'inv-1' }];
    mockState.invoice_line_items = [{ id: 'ill-1', invoice_id: 'inv-1' }];
    mockState.payments = [{ id: 'pay-1', invoice_id: 'inv-1' }];
    mockState.financial_transactions = [{ id: 'ft-1', invoice_line_item_id: 'ill-1' }];
    mockState.stripe_webhook_events = [];
    mockState.deleteOrder = [];
    mockState.failOnStep = null;
    mockState.missingTables = new Set<string>();
  });

  it('dry run does not mutate data', async () => {
    const before = structuredClone(mockState);
    const plan = await getImportedDataResetPlan();
    expect(plan.counts.applications).toBe(1);
    expect(mockState).toEqual(before);
  });

  it('deletes children before parents and preserves safe customers', async () => {
    const result = await resetImportedDataAndFinancials();
    expect(result.counts.manualInvoiceItems).toBe(1);
    expect(result.counts.manualInvoices).toBe(1);
    expect(result.counts.rentals).toBe(1);
    expect(result.counts.applications).toBe(1);
    expect(result.counts.customers).toBe(1);
    expect(mockState.deleteOrder).toEqual([
      'manual_invoice_items',
      'manual_invoices',
      'financial_transactions',
      'payments',
      'invoice_items',
      'invoice_line_items',
      'invoices',
      'rentals',
      'applications',
      'customers',
    ]);
    expect(mockState.customers).toHaveLength(1);
    expect(mockState.customers[0].id).toBe('cust-2');
  });

  it('returns a failing step when a delete fails', async () => {
    mockState.failOnStep = 'rentals';
    await expect(resetImportedDataAndFinancials()).rejects.toMatchObject({
      step: 'delete_rentals',
      message: 'Reset failed while deleting rentals rows.',
    });
  });

  it('skips missing invoice child tables safely', async () => {
    mockState.missingTables = new Set(['invoice_items', 'payments']);

    const result = await resetImportedDataAndFinancials();

    expect(result.counts.invoices).toBe(1);
    expect(result.skippedInvoiceDependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'invoice_items', skipped: true }),
        expect.objectContaining({ table: 'payments', skipped: true }),
      ]),
    );
  });
});
