export const SITE_NAME = 'Aurora Rentals';
export const SITE_URL = 'https://www.aurorarentals.com.au';
export const DEFAULT_SOCIAL_IMAGE_PATH = '/hero-camry.webp';

export type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

export const buildCanonicalUrl = (path = '/') => new URL(path, SITE_URL).toString();
