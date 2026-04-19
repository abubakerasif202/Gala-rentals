import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('schemaCompat', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      VITEST: 'false',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it('keeps created_at snake_case when the cars table mixes camel and snake fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          definitions: {
            applications: { properties: {} },
            cars: {
              properties: {
                created_at: { type: 'string' },
                modelYear: { type: 'number' },
                weeklyPrice: { type: 'number' },
              },
            },
            rentals: { properties: {} },
          },
        }),
        status: 200,
        statusText: 'OK',
      })
    );

    const { getCarCreatedAtColumn, getCarSelectColumns } = await import('./schemaCompat.js');

    await expect(getCarCreatedAtColumn()).resolves.toBe('created_at');
    await expect(getCarSelectColumns()).resolves.toBe(
      'id, name, model_year:modelYear, weekly_price:weeklyPrice, bond, status, image, archived_at:archivedAt, created_at'
    );
  });

  it('uses deterministic defaults in production even when introspection fails', async () => {
    process.env.NODE_ENV = 'production';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
    );

    const { getSchemaCompat } = await import('./schemaCompat.js');

    await expect(getSchemaCompat()).resolves.toMatchObject({
      applicationAssignedCarColumn: 'assigned_car_id',
      carCreatedAtColumn: 'created_at',
      coreMode: 'snake',
      rentalStripeSubscriptionColumn: 'stripe_subscription_id',
    });
  });

  it('uses the inspected production schema when the live database is still camelCase', async () => {
    process.env.NODE_ENV = 'production';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          definitions: {
            applications: {
              properties: {
                approvedAt: { type: 'string' },
                approvedBond: { type: 'number' },
                approvedWeeklyPrice: { type: 'number' },
                assignedCarId: { type: 'number' },
                licenseBackPhoto: { type: 'string' },
                paidAt: { type: 'string' },
                paymentLinkSentAt: { type: 'string' },
                paymentLinkVersion: { type: 'number' },
                pendingCheckoutSessionId: { type: 'string' },
              },
            },
            cars: {
              properties: {
                created_at: { type: 'string' },
                modelYear: { type: 'number' },
                weeklyPrice: { type: 'number' },
              },
            },
            rentals: {
              properties: {
                stripeCustomerId: { type: 'string' },
                stripeSubscriptionId: { type: 'string' },
              },
            },
          },
        }),
        status: 200,
        statusText: 'OK',
      })
    );

    const { getSchemaCompat } = await import('./schemaCompat.js');

    await expect(getSchemaCompat()).resolves.toMatchObject({
      applicationAssignedCarColumn: 'assignedCarId',
      applicationApprovedAtColumn: 'approvedAt',
      applicationApprovedBondColumn: 'approvedBond',
      applicationApprovedWeeklyPriceColumn: 'approvedWeeklyPrice',
      applicationBackPhotoColumn: 'licenseBackPhoto',
      applicationPaidAtColumn: 'paidAt',
      applicationPaymentLinkSentAtColumn: 'paymentLinkSentAt',
      applicationPaymentLinkVersionColumn: 'paymentLinkVersion',
      applicationPendingCheckoutSessionColumn: 'pendingCheckoutSessionId',
      carCreatedAtColumn: 'created_at',
      coreMode: 'camel',
      rentalStripeCustomerColumn: 'stripeCustomerId',
      rentalStripeSubscriptionColumn: 'stripeSubscriptionId',
    });
  });

  it('retries schema introspection after cache TTL in non-production mode', async () => {
    process.env.NODE_ENV = 'development';
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          definitions: {
            applications: { properties: {} },
            cars: {
              properties: {
                created_at: { type: 'string' },
                modelYear: { type: 'number' },
                weeklyPrice: { type: 'number' },
              },
            },
            rentals: { properties: {} },
          },
        }),
        status: 200,
        statusText: 'OK',
      });

    vi.stubGlobal('fetch', fetchMock);

    const { getCarSelectColumns } = await import('./schemaCompat.js');

    await expect(getCarSelectColumns()).resolves.toBe(
      'id, name, model_year, weekly_price, bond, status, image, archived_at, created_at'
    );

    vi.advanceTimersByTime(61_000);

    await expect(getCarSelectColumns()).resolves.toBe(
      'id, name, model_year:modelYear, weekly_price:weeklyPrice, bond, status, image, archived_at:archivedAt, created_at'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
