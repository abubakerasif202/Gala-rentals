import { describe, expect, it } from 'vitest';

import type { RequestLike } from './frontendRouting.js';

import {
  isPrivateSpaRoute,
  shouldServeSpaEntry,
} from './frontendRouting.js';

const createRequest = ({
  accept = 'text/html,application/xhtml+xml',
  method = 'GET',
  path,
}: {
  accept?: string;
  method?: string;
  path: string;
}) =>
  ({
    method,
    path,
    get: (headerName: string) =>
      headerName.toLowerCase() === 'accept' ? accept : undefined,
  }) satisfies RequestLike;

describe('shouldServeSpaEntry', () => {
  it('allows known client routes', () => {
    expect(shouldServeSpaEntry(createRequest({ path: '/' }))).toBe(true);
    expect(shouldServeSpaEntry(createRequest({ path: '/admin' }))).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/admin/settings' }))
    ).toBe(true);
    expect(shouldServeSpaEntry(createRequest({ path: '/apply' }))).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/application' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/applications/abc123' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/checkout' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/checkout/abc123' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/driver/onboarding' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/rental/active' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/agreement/123' }))
    ).toBe(true);
    expect(shouldServeSpaEntry(createRequest({ path: '/toll' }))).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/admin/dashboard' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/admin/agreements' }))
    ).toBe(true);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/admin/toll-notices' }))
    ).toBe(true);
  });

  it('classifies only internal client routes as private', () => {
    expect(isPrivateSpaRoute('/')).toBe(false);
    expect(isPrivateSpaRoute('/#services')).toBe(false);
    expect(isPrivateSpaRoute('/apply')).toBe(true);
    expect(isPrivateSpaRoute('/checkout')).toBe(true);
    expect(isPrivateSpaRoute('/checkout/abc123')).toBe(true);
    expect(isPrivateSpaRoute('/admin')).toBe(true);
    expect(isPrivateSpaRoute('/admin/settings')).toBe(true);
    expect(isPrivateSpaRoute('/admin/dashboard')).toBe(true);
    expect(isPrivateSpaRoute('/applications/abc123')).toBe(true);
    expect(isPrivateSpaRoute('/driver/onboarding')).toBe(true);
    expect(isPrivateSpaRoute('/rental/active')).toBe(true);
    expect(isPrivateSpaRoute('/agreement/123')).toBe(true);
    expect(isPrivateSpaRoute('/toll')).toBe(true);
  });

  it('allows root path regardless of accept header', () => {
    expect(
      shouldServeSpaEntry(
        createRequest({ accept: 'application/json', path: '/' })
      )
    ).toBe(true);
  });

  it('rejects scanner-style secret and debug probes', () => {
    expect(shouldServeSpaEntry(createRequest({ path: '/.env' }))).toBe(false);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/.git/config' }))
    ).toBe(false);
    expect(
      shouldServeSpaEntry(createRequest({ path: '/wp-config.php' }))
    ).toBe(false);
    expect(shouldServeSpaEntry(createRequest({ path: '/_debugbar/' }))).toBe(
      false
    );
  });

  it('rejects API routes and non-html fetches', () => {
    expect(
      shouldServeSpaEntry(createRequest({ path: '/api/health' }))
    ).toBe(false);
    expect(
      shouldServeSpaEntry(
        createRequest({ accept: 'application/json', path: '/pricing' })
      )
    ).toBe(false);
  });
});
