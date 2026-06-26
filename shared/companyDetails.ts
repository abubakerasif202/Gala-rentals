export const companyDetails = {
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
} as const;

export const tollNoticeCompanyDefaults = {
  organisation_address: companyDetails.address,
  organisation_name: companyDetails.displayName,
  organisation_phone: companyDetails.phone,
} as const;

export const formatCompanyAddress = () =>
  companyDetails.address ||
  [companyDetails.state, companyDetails.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
