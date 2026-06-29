export const maintenanceResetCountLabels: Record<string, string> = {
  applications: 'Applications',
  bookings: 'Bookings',
  customers: 'Customers',
  rentals: 'Rentals',
  leaseAgreements: 'Lease Agreements',
  tollTransferNotices: 'Toll Transfer Notices',
  tollTransferNoticeAuditEvents: 'Toll Transfer Notice Audit Events',
  invoices: 'Invoices',
  invoiceItems: 'Invoice Items',
  invoiceLineItems: 'Invoice Line Items',
  payments: 'Payments',
  financialTransactions: 'Financial Transactions',
  manualInvoices: 'Manual Invoices',
  manualInvoiceItems: 'Manual Invoice Items',
  financialRows: 'Financial Rows',
  stripeWebhookEvents: 'Stripe Webhook Events',
  agreements: 'Lease Agreements',
  tollNotices: 'Toll Transfer Notices',
};

export const getMaintenanceResetLabel = (key: string) =>
  maintenanceResetCountLabels[key] ||
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
