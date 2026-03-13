import { describe, expect, it } from 'vitest';

import {
  APPLICATION_IMAGE_CONTENT_TYPES,
  isFutureAustraliaDate,
  isTodayOrFutureAustraliaDate,
  isValidDateOnly,
  normalizeApplicationEmail,
  normalizeAustralianMobile,
} from './applicationSubmission.js';

describe('applicationSubmission helpers', () => {
  it('normalizes applicant emails before validation', () => {
    expect(normalizeApplicationEmail(' Driver@Example.com ')).toBe('driver@example.com');
  });

  it('normalizes Australian mobile numbers to a stable local format', () => {
    expect(normalizeAustralianMobile('0400 000 111')).toBe('0400000111');
    expect(normalizeAustralianMobile('+61 400 000 111')).toBe('0400000111');
  });

  it('validates date-only strings strictly', () => {
    expect(isValidDateOnly('2026-03-11')).toBe(true);
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('03/11/2026')).toBe(false);
  });

  it('compares licence expiry dates against the Australian current day', () => {
    expect(isFutureAustraliaDate('2026-03-12', '2026-03-11')).toBe(true);
    expect(isFutureAustraliaDate('2026-03-11', '2026-03-11')).toBe(false);
  });

  it('allows start dates that are today or later', () => {
    expect(isTodayOrFutureAustraliaDate('2026-03-11', '2026-03-11')).toBe(true);
    expect(isTodayOrFutureAustraliaDate('2026-03-10', '2026-03-11')).toBe(false);
  });

  it('keeps client upload types aligned with the API allow-list', () => {
    expect(APPLICATION_IMAGE_CONTENT_TYPES).toEqual([
      'image/jpeg',
      'image/jpg',
      'image/png',
    ]);
  });
});
