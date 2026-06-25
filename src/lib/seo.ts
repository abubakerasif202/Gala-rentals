export const SITE_NAME = 'Galarentals';
export const SITE_URL = 'https://www.galarentals.com.au';
export const DEFAULT_SOCIAL_IMAGE_PATH = '/images/rental-service-hero.svg';

export type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

export const buildCanonicalUrl = (path = '/') => new URL(path, SITE_URL).toString();
