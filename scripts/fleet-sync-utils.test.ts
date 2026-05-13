import { describe, expect, it } from 'vitest';

import {
  getApplicationApprovedVehicle,
  getApplicationSelectList,
  getRentalApplicationId,
  getRentalSelectList,
  mapApplicationPayloadForSchema,
  mapRentalPayloadForSchema,
} from './fleet-sync-utils.js';

describe('fleet sync schema utilities', () => {
  it('supports table-specific schema modes', () => {
    const schemaMode = {
      applications: 'camel',
      cars: 'snake',
      rentals: 'camel',
    };

    expect(getApplicationSelectList(schemaMode)).toContain('assignedCarId');
    expect(getRentalSelectList(schemaMode)).toContain('applicationId');
    expect(getRentalApplicationId({ applicationId: 42 }, schemaMode)).toBe(42);
    expect(
      mapApplicationPayloadForSchema(
        {
          address: '1 Test Street',
          approved_at: null,
          approved_bond: 500,
          approved_weekly_price: 350,
          assigned_car_id: 7,
          email: 'driver@example.invalid',
          experience: 'Imported',
          intended_start_date: '2026-05-01',
          legacy_id: 900000000001,
          license_expiry: '2027-05-01',
          license_number: 'LEGACY-123',
          name: 'Driver',
          paid_at: null,
          payment_link_sent_at: null,
          payment_link_version: 1,
          pending_checkout_session_id: null,
          phone: '0400000000',
          status: 'Approved',
          uber_status: 'Active',
          weekly_budget: '350',
        },
        schemaMode
      )
    ).toMatchObject({
      assignedCarId: 7,
      approvedBond: 500,
      licenseNumber: 'LEGACY-123',
    });
  });

  it('omits missing assigned-car columns and can read approved vehicle fallback', () => {
    const schemaMode = {
      applications: {
        assignedCarColumn: null,
        approvedVehicleColumn: 'approved_vehicle',
        legacyIdColumn: 'legacy_id',
        mode: 'snake',
      },
      cars: 'snake',
      rentals: {
        legacyApplicationColumn: 'legacy_application_id',
        mode: 'snake',
      },
    };

    const selectList = getApplicationSelectList(schemaMode);
    expect(selectList).not.toContain('assigned_car_id');
    expect(selectList).toContain('approved_vehicle');
    expect(
      getApplicationApprovedVehicle({ approved_vehicle: 'YNU51C' }, schemaMode)
    ).toBe('YNU51C');
    expect(
      mapApplicationPayloadForSchema(
        {
          address: '1 Test Street',
          approved_at: null,
          approved_bond: 500,
          approved_vehicle: 'YNU51C',
          approved_weekly_price: 350,
          assigned_car_id: 7,
          email: 'driver@example.invalid',
          experience: 'Imported',
          intended_start_date: '2026-05-01',
          legacy_id: 900000000001,
          license_expiry: '2027-05-01',
          license_number: 'LEGACY-123',
          name: 'Driver',
          paid_at: null,
          payment_link_sent_at: null,
          payment_link_version: 1,
          pending_checkout_session_id: null,
          phone: '0400000000',
          status: 'Approved',
          uber_status: 'Active',
          weekly_budget: '350',
        },
        schemaMode
      )
    ).toMatchObject({
      approved_vehicle: 'YNU51C',
      approved_bond: 500,
      legacy_id: 900000000001,
      license_number: 'LEGACY-123',
    });
    expect(
      mapRentalPayloadForSchema(
        {
          application_id: '00000000-0000-4000-8000-000000000001',
          bond_paid: 0,
          car_id: 3,
          legacy_application_id: 900000000001,
          start_date: '2026-05-01',
          status: 'Active',
          weekly_price: 350,
        },
        schemaMode
      )
    ).toMatchObject({
      application_id: '00000000-0000-4000-8000-000000000001',
      legacy_application_id: 900000000001,
    });
  });
});
