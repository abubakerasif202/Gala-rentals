import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('schemaCompat', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
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
      'id, name, model_year:modelYear, weekly_price:weeklyPrice, bond, status, image, created_at'
    );
  });
});
