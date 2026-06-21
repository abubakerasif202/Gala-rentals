export const SITE_NAME = 'Gala Rentals';
export const SITE_URL = 'https://www.gala-rentals.com.au';
export const DEFAULT_SOCIAL_IMAGE_PATH = '/car-images/ai-gala-navy-sedan-front.png';

export type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

export const buildCanonicalUrl = (path = '/') => new URL(path, SITE_URL).toString();
