import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderApplicationLeaseAgreement } from './agreementGeneration.js';

const restoreLeaseAgreementEnv = () => {
  delete process.env.LEASE_OWNER_NAME;
  delete process.env.LEASE_OWNER_ADDRESS;
  delete process.env.LEASE_OWNER_CONTACT;
  delete process.env.LEASE_OWNER_EMAIL;
};

afterEach(() => {
  restoreLeaseAgreementEnv();
});

beforeEach(() => {
  restoreLeaseAgreementEnv();
});

describe('renderApplicationLeaseAgreement', () => {
  it('uses Galarentals defaults when lease owner env overrides are not set', () => {
    const agreement = renderApplicationLeaseAgreement(
      {
        name: 'Jordan Driver',
        email: 'jordan@example.com',
        phone: '0400111222',
        address: '22 Test Street',
        license_number: 'NSW12345',
        intended_start_date: '2026-03-20',
      },
      {
        name: 'Toyota Camry Hybrid',
        model_year: 2024,
      },
      450,
      '2026-03-19T08:00:00.000Z',
      900
    );

    expect(agreement).toContain('Name: Sarfraz Ahmad');
    expect(agreement).toContain('Address: Sydney NSW');
    expect(agreement).toContain('Contact: +61415228557');
    expect(agreement).toContain('Email: admin@galarentals.com.au');
  });

  it('fills lease agreements with configured owner details and non-placeholder fallbacks', () => {
    process.env.LEASE_OWNER_NAME = 'Sarfraz Ahmad';
    process.env.LEASE_OWNER_ADDRESS = 'Sydney NSW';
    process.env.LEASE_OWNER_CONTACT = '+61415228557';
    process.env.LEASE_OWNER_EMAIL = 'admin@galarentals.com.au';

    const agreement = renderApplicationLeaseAgreement(
      {
        name: 'Jordan Driver',
        email: 'jordan@example.com',
        phone: '0400111222',
        address: '22 Test Street',
        license_number: 'NSW12345',
        intended_start_date: '2026-03-20',
      },
      {
        name: 'Toyota Camry Hybrid',
        model_year: 2024,
      },
      450,
      '2026-03-19T08:00:00.000Z',
      900
    );

    expect(agreement).toContain('Name: Sarfraz Ahmad');
    expect(agreement).toContain('Address: Sydney NSW');
    expect(agreement).toContain('Contact: +61415228557');
    expect(agreement).toContain('Email: admin@galarentals.com.au');
    expect(agreement).toContain('Date of Birth: Not provided');
    expect(agreement).toContain('VIN: To be assigned');
    expect(agreement).not.toContain('Business Address');
    expect(agreement).not.toContain('leasing@example.com');
    expect(agreement).not.toContain('TBD');
    expect(agreement).not.toContain('1990-01-01');
  });

  it('uses manually typed application vehicle text and rego instead of requiring a cars row', () => {
    const agreement = renderApplicationLeaseAgreement(
      {
        name: 'Manual Vehicle Driver',
        email: 'manual@example.com',
        phone: '0400111222',
        address: '22 Test Street',
        license_number: 'NSW12345',
        intended_start_date: '2026-03-20',
        assigned_vehicle_text: 'Toyota Camry Hybrid DC95MA',
        assigned_vehicle_rego: 'DC95MA',
      },
      {},
      450,
      '2026-03-19T08:00:00.000Z',
      900
    );

    expect(agreement).toContain('Make: Toyota');
    expect(agreement).toContain('Model: Toyota Camry Hybrid DC95MA');
    expect(agreement).toContain('VIN: DC95MA');
  });

  it('renders a safe placeholder when no manual vehicle text is available', () => {
    const agreement = renderApplicationLeaseAgreement(
      {
        name: 'Unassigned Driver',
        email: 'unassigned@example.com',
        phone: '0400111222',
        address: '22 Test Street',
        license_number: 'NSW12345',
        intended_start_date: '2026-03-20',
      },
      {},
      450,
      '2026-03-19T08:00:00.000Z',
      900
    );

    expect(agreement).toContain('Make: To be assigned');
    expect(agreement).toContain('Model: To be assigned');
    expect(agreement).toContain('VIN: To be assigned');
  });
});
