import { describe, expect, it } from 'vitest';
import { sanitizeOriginalUrl } from './requestLogger.js';

describe('request log URL sanitization', () => {
  it('redacts application, Stripe, and token identifiers', () => {
    const value = sanitizeOriginalUrl(
      '/api/stripe/checkout-sessions/cs_live_secret?application_id=550e8400-e29b-41d4-a716-446655440000&checkout_token=secret&subscription_id=sub_secret'
    );

    expect(value).not.toContain('cs_live_secret');
    expect(value).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(value).not.toContain('secret');
  });

  it('redacts UUID path segments while preserving route names', () => {
    const value = sanitizeOriginalUrl(
      '/api/applications/550e8400-e29b-41d4-a716-446655440000/cancel'
    );
    expect(value).toContain('/api/applications/');
    expect(value).toContain('/cancel');
    expect(value).not.toContain('550e8400');
  });
});
