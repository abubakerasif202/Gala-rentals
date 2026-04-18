import { describe, expect, it, vi } from 'vitest';

const mockGetSchemaCompat = vi.hoisted(() => vi.fn());

vi.mock('./schemaCompat.js', async () => {
  const actual = await vi.importActual<typeof import('./schemaCompat.js')>(
    './schemaCompat.js'
  );

  return {
    ...actual,
    getSchemaCompat: mockGetSchemaCompat,
  };
});

import { buildLockedApplicationSelectSql } from './paymentActivation.js';

describe('buildLockedApplicationSelectSql', () => {
  it('aliases legacy camelCase application columns to the stable activation field names', async () => {
    mockGetSchemaCompat.mockResolvedValue({
      applicationAssignedCarColumn: 'assignedCarId',
      applicationPaymentLinkVersionColumn: 'paymentLinkVersion',
    });

    await expect(buildLockedApplicationSelectSql()).resolves.toBe(
      'SELECT status, "paymentLinkVersion" AS payment_link_version, "assignedCarId" AS assigned_car_id FROM "applications" WHERE id = $1 FOR UPDATE'
    );
  });

  it('keeps modern snake_case application columns quoted and aliased consistently', async () => {
    mockGetSchemaCompat.mockResolvedValue({
      applicationAssignedCarColumn: 'assigned_car_id',
      applicationPaymentLinkVersionColumn: 'payment_link_version',
    });

    await expect(buildLockedApplicationSelectSql()).resolves.toBe(
      'SELECT status, "payment_link_version" AS payment_link_version, "assigned_car_id" AS assigned_car_id FROM "applications" WHERE id = $1 FOR UPDATE'
    );
  });
});
