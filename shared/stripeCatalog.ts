export const STRIPE_CATALOG_APP_METADATA_KEY = 'gala_rental_app';
export const STRIPE_CATALOG_KIND_METADATA_KEY = 'gala_rental_catalog_kind';
export const STRIPE_CATALOG_APP_METADATA_VALUE = 'gala-rentals';

export const stripeCatalogDefinitions = {
  securityBond: {
    description: 'Refundable bond collected before activation.',
    envVar: 'STRIPE_SECURITY_BOND_PRODUCT_ID',
    kind: 'security_bond',
    name: 'Security Bond',
  },
  onboardingSetup: {
    description: 'Account and direct debit setup.',
    envVar: 'STRIPE_ONBOARDING_SETUP_PRODUCT_ID',
    kind: 'onboarding_setup_fees',
    name: 'Onboarding setup fees',
  },
  weeklyRental: {
    description: 'Recurring weekly rental subscription.',
    envVar: 'STRIPE_WEEKLY_RENTAL_PRODUCT_ID',
    kind: 'weekly_rental',
    name: 'Weekly vehicle rental',
  },
} as const;

export type StripeCatalogProductKey = keyof typeof stripeCatalogDefinitions;

export type StripeCatalogProductDefinition =
  (typeof stripeCatalogDefinitions)[StripeCatalogProductKey];

export const stripeCatalogEntries = Object.entries(
  stripeCatalogDefinitions
) as Array<[StripeCatalogProductKey, StripeCatalogProductDefinition]>;

export const buildStripeCatalogMetadata = (
  kind: StripeCatalogProductDefinition['kind']
) => ({
  [STRIPE_CATALOG_APP_METADATA_KEY]: STRIPE_CATALOG_APP_METADATA_VALUE,
  [STRIPE_CATALOG_KIND_METADATA_KEY]: kind,
});
