import { describe, expect, it } from 'vitest';

import {
  parseHashCheckoutToken,
  scrubCheckoutTokenFromUrl,
} from './checkoutTokenUrl';

describe('checkoutTokenUrl', () => {
  it('parses checkout token from hash payload', () => {
    expect(parseHashCheckoutToken('#checkout_token=abc123')).toBe('abc123');
    expect(parseHashCheckoutToken('#token=legacy123')).toBe('legacy123');
    expect(parseHashCheckoutToken('')).toBe('');
  });

  it('scrubs checkout token from query and hash', () => {
    const url = new URL(
      'https://example.com/success?application_id=2&checkout_token=secret#checkout_token=other'
    );

    const scrubbed = scrubCheckoutTokenFromUrl(url);

    expect(scrubbed.searchParams.get('checkout_token')).toBeNull();
    expect(scrubbed.searchParams.get('application_id')).toBe('2');
    expect(scrubbed.hash).toBe('');
  });
});
