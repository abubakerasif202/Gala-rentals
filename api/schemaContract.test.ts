import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('schemaContract', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      VITEST: 'false',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('passes when required contract columns exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          definitions: {
            applications: {
              properties: {
                approved_at: { type: 'string' },
                approved_bond: { type: 'number' },
                approved_vehicle: { type: 'string' },
                approved_weekly_price: { type: 'number' },
                assigned_car_id: { type: 'number' },
                paid_at: { type: 'string' },
                payment_link_sent_at: { type: 'string' },
                payment_link_version: { type: 'number' },
                pending_checkout_session_id: { type: 'string' },
              },
            },
            cars: { properties: { created_at: { type: 'string' } } },
            rentals: {
              properties: {
                stripe_customer_id: { type: 'string' },
                stripe_subscription_id: { type: 'string' },
              },
            },
            stripe_webhook_events: {
              properties: {
                stripe_event_id: { type: 'string' },
                status: { type: 'string' },
                received_at: { type: 'string' },
              },
            },
          },
        }),
      })
    );

    const {
      resetSchemaContractValidationForTests,
      verifyProductionSchemaContract,
    } = await import('./schemaContract.js');

    resetSchemaContractValidationForTests();
    await expect(verifyProductionSchemaContract()).resolves.toBeUndefined();
  });

  it('passes when the live schema still exposes legacy camelCase payment columns', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          definitions: {
            applications: {
              properties: {
                approvedAt: { type: 'string' },
                approvedBond: { type: 'number' },
                approvedVehicle: { type: 'string' },
                approvedWeeklyPrice: { type: 'number' },
                assignedCarId: { type: 'number' },
                licenseBackPhoto: { type: 'string' },
                paidAt: { type: 'string' },
                paymentLinkSentAt: { type: 'string' },
                paymentLinkVersion: { type: 'number' },
                pendingCheckoutSessionId: { type: 'string' },
              },
            },
            cars: { properties: { created_at: { type: 'string' }, modelYear: { type: 'number' } } },
            rentals: {
              properties: {
                stripeCustomerId: { type: 'string' },
                stripeSubscriptionId: { type: 'string' },
              },
            },
            stripe_webhook_events: {
              properties: {
                stripe_event_id: { type: 'string' },
                status: { type: 'string' },
                received_at: { type: 'string' },
              },
            },
          },
        }),
      })
    );

    const {
      resetSchemaContractValidationForTests,
      verifyProductionSchemaContract,
    } = await import('./schemaContract.js');

    resetSchemaContractValidationForTests();
    await expect(verifyProductionSchemaContract()).resolves.toBeUndefined();
  });

  it('fails when required contract columns are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          definitions: {
            applications: {
              properties: {
                approved_at: { type: 'string' },
              },
            },
            cars: { properties: { created_at: { type: 'string' } } },
            rentals: { properties: {} },
            stripe_webhook_events: { properties: {} },
          },
        }),
      })
    );

    const {
      resetSchemaContractValidationForTests,
      verifyProductionSchemaContract,
    } = await import('./schemaContract.js');

    resetSchemaContractValidationForTests();
    await expect(verifyProductionSchemaContract()).rejects.toThrow(
      'Production schema contract check failed'
    );
  });

  it('fails with actionable message when schema inspection endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
    );

    const {
      resetSchemaContractValidationForTests,
      verifyProductionSchemaContract,
    } = await import('./schemaContract.js');

    resetSchemaContractValidationForTests();
    await expect(verifyProductionSchemaContract()).rejects.toThrow(
      'Failed to verify production schema contract: 503 Service Unavailable'
    );
  });
});
