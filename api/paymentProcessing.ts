import { hasTransactionalPostgresConnection } from './db/postgres.js';

export type PaymentProcessingMode = 'transactional' | 'restricted';

export const PUBLIC_PAYMENTS_UNAVAILABLE_MESSAGE =
  'Payments are temporarily unavailable. Please contact support.';
export const ADMIN_PAYMENTS_RESTRICTED_MESSAGE =
  'Transactional Postgres access is required before sending payment links.';
export const AUTOMATIC_PAYMENT_ACTIVATION_RESTRICTED_REASON =
  'Automatic payment-state recording is blocked until transactional Postgres access is configured.';

export const getPaymentProcessingMode = (): PaymentProcessingMode =>
  hasTransactionalPostgresConnection() ? 'transactional' : 'restricted';

export const hasTransactionalPaymentProcessing = () =>
  getPaymentProcessingMode() === 'transactional';

export const createPaymentProcessingRestrictedError = (
  message = PUBLIC_PAYMENTS_UNAVAILABLE_MESSAGE
) =>
  Object.assign(new Error(message), {
    code: 'PAYMENT_PROCESSING_RESTRICTED',
    status: 503,
  });

export const assertTransactionalPaymentProcessing = (message?: string) => {
  if (!hasTransactionalPaymentProcessing()) {
    throw createPaymentProcessingRestrictedError(message);
  }
};
