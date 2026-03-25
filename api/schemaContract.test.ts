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
      VITEST: 'true',
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
