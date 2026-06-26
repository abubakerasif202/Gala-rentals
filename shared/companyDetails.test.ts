import { describe, expect, it } from 'vitest';

import {
  companyDetails,
  formatCompanyAddress,
  tollNoticeCompanyDefaults,
} from './companyDetails.js';

describe('companyDetails', () => {
  it('contains the confirmed Gala Rentals company identity', () => {
    expect(companyDetails).toMatchObject({
      abn: '35 657 943 596',
      acn: '657 943 596',
      address: '24 Kinghorne St, Gledswood Hills NSW 2557',
      brandName: 'Gala Rentals',
      country: 'Australia',
      displayName: 'GALA RENTALS',
      legalName: 'SOUTH HILLS VENTURE PTY LTD',
      ownerName: 'Sarfraz Ahmad',
      phone: '+61415228557',
      state: 'NSW',
      tradingName: 'Galarentals',
    });
  });

  it('formats the configured address without duplicating NSW or Australia', () => {
    expect(formatCompanyAddress()).toBe('24 Kinghorne St, Gledswood Hills NSW 2557');
    expect(formatCompanyAddress()).not.toContain('NSW 2557, NSW');
    expect(formatCompanyAddress()).not.toContain('Australia');
  });

  it('builds toll notice defaults from the shared company details object', () => {
    expect(tollNoticeCompanyDefaults.organisation_name).toBe(companyDetails.displayName);
    expect(tollNoticeCompanyDefaults.organisation_address).toBe(companyDetails.address);
    expect(tollNoticeCompanyDefaults.organisation_phone).toBe(companyDetails.phone);
    expect(tollNoticeCompanyDefaults).toEqual({
      organisation_address: '24 Kinghorne St, Gledswood Hills NSW 2557',
      organisation_name: 'GALA RENTALS',
      organisation_phone: '+61415228557',
    });
  });
});
