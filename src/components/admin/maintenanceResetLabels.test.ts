import { describe, expect, it } from 'vitest';

import { getMaintenanceResetLabel } from './maintenanceResetLabels.js';

describe('maintenance reset labels', () => {
  it('humanizes reset count keys used by the maintenance dry run', () => {
    expect(getMaintenanceResetLabel('applications')).toBe('Applications');
    expect(getMaintenanceResetLabel('leaseAgreements')).toBe('Lease Agreements');
    expect(getMaintenanceResetLabel('tollTransferNoticeAuditEvents')).toBe(
      'Toll Transfer Notice Audit Events'
    );
    expect(getMaintenanceResetLabel('invoiceLineItems')).toBe('Invoice Line Items');
    expect(getMaintenanceResetLabel('financialTransactions')).toBe('Financial Transactions');
    expect(getMaintenanceResetLabel('stripeWebhookEvents')).toBe('Stripe Webhook Events');
  });

  it('falls back to readable labels for new camel, snake, or kebab case keys', () => {
    expect(getMaintenanceResetLabel('futureImportedRows')).toBe('Future Imported Rows');
    expect(getMaintenanceResetLabel('future_imported_rows')).toBe('Future Imported Rows');
    expect(getMaintenanceResetLabel('future-imported-rows')).toBe('Future Imported Rows');
  });
});
