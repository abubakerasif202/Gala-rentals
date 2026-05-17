import { describe, expect, it } from 'vitest';

import {
  filterRealApplications,
  filterRealOperationalCustomers,
  filterRealOperationalInvoices,
  filterRealRentals,
  isImportedApplicationRecord,
  isImportedRentalRecord,
} from './importedDataFilters.js';

describe('importedDataFilters', () => {
  it('detects legacy fleet applications without relying on the date alone', () => {
    expect(
      isImportedApplicationRecord({
        id: 'legacy-app',
        legacy_id: 900000000001,
        email: 'legacy-cno40s@example.invalid',
        phone: '0000000000',
        license_number: 'LEGACY-CNO40S',
        experience: 'Imported from live fleet data on 2026-05-17.',
        intended_start_date: '2026-05-17',
        status: 'Paid',
      }),
    ).toBe(true);

    expect(
      isImportedApplicationRecord({
        id: 'real-app',
        legacy_id: null,
        email: 'real.driver@example.com',
        phone: '0412345678',
        license_number: 'NSW123456',
        experience: 'Experienced rideshare driver',
        intended_start_date: '2026-05-17',
        status: 'Paid',
      }),
    ).toBe(false);
  });

  it('keeps real applications and rentals even when Stripe IDs are not linked yet', () => {
    const applications = [
      {
        id: 'legacy-app',
        email: 'legacy-cno40s@example.invalid',
        phone: '0000000000',
        license_number: 'LEGACY-CNO40S',
        experience: 'Imported from live fleet data on 2026-05-17.',
      },
      {
        id: 'real-app',
        email: 'real.driver@example.com',
        phone: '0412345678',
        license_number: 'NSW123456',
        experience: 'Manually created by admin',
      },
    ];
    const importedApplicationIds = new Set(['legacy-app']);
    const rentals = [
      {
        id: 1,
        application_id: 'legacy-app',
        legacy_application_id: null,
        stripe_subscription_id: null,
        stripe_customer_id: null,
      },
      {
        id: 2,
        application_id: 'real-app',
        legacy_application_id: null,
        stripe_subscription_id: null,
        stripe_customer_id: null,
      },
      {
        id: 3,
        application_id: 'real-app',
        legacy_application_id: 900000000003,
        stripe_subscription_id: null,
        stripe_customer_id: null,
      },
    ];

    expect(filterRealApplications(applications).map((row) => row.id)).toEqual(['real-app']);
    expect(isImportedRentalRecord(rentals[0], importedApplicationIds)).toBe(true);
    expect(isImportedRentalRecord(rentals[1], importedApplicationIds)).toBe(false);
    expect(isImportedRentalRecord(rentals[2], importedApplicationIds)).toBe(true);
    expect(filterRealRentals(rentals, importedApplicationIds).map((row) => row.id)).toEqual([2]);
  });

  it('filters imported operational customers and invoices by explicit source markers', () => {
    expect(
      filterRealOperationalCustomers([
        { id: 1, source: 'legacy-import', email: 'legacy@example.invalid' },
        { id: 2, source: 'current', email: 'real@example.com' },
      ]).map((row) => row.id),
    ).toEqual([2]);

    expect(
      filterRealOperationalInvoices([
        { id: 'inv-legacy', source: 'legacy-import', customer_id: 1 },
        { id: 'inv-real', source: 'current', customer_id: 2 },
      ], new Set(['1'])).map((row) => row.id),
    ).toEqual(['inv-real']);
  });
});
