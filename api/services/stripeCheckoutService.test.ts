import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckoutSessionRetrieve = vi.hoisted(() => vi.fn());

vi.mock('../stripeClient.js', () => ({
  getStripeClient: () => ({
    checkout: {
      sessions: {
        retrieve: mockCheckoutSessionRetrieve,
      },
    },
  }),
}));

import {
  buildHostedCheckoutSessionIdempotencyKey,
  resolvePendingCheckoutSession,
} from './stripeCheckoutService.js';

describe('stripeCheckoutService checkout helpers', () => {
  beforeEach(() => {
    mockCheckoutSessionRetrieve.mockReset();
  });

  it('builds deterministic checkout idempotency keys per application version', () => {
    expect(
      buildHostedCheckoutSessionIdempotencyKey({
        applicationId: '11111111-1111-4111-8111-111111111111',
        paymentLinkVersion: 7,
      })
    ).toBe('vehicle-checkout:11111111-1111-4111-8111-111111111111:v7');

    expect(
      buildHostedCheckoutSessionIdempotencyKey({
        applicationId: '11111111-1111-4111-8111-111111111111',
        paymentLinkVersion: 7,
        retryKeySeed: 'cs_retry_seed',
      })
    ).toBe('vehicle-checkout:11111111-1111-4111-8111-111111111111:v7:retry:cs_retry_seed');
  });

  it('reuses an open checkout session when it still matches the current application and version', async () => {
    mockCheckoutSessionRetrieve.mockResolvedValueOnce({
      id: 'cs_open_vehicle',
      metadata: {
        application_id: '11111111-1111-4111-8111-111111111111',
        checkout_kind: 'vehicle',
        payment_link_version: '4',
      },
      status: 'open',
      url: 'https://checkout.stripe.com/pay/cs_open_vehicle',
    });

    await expect(
      resolvePendingCheckoutSession({
        application: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'driver@example.com',
          name: 'Driver One',
          payment_link_version: 4,
          pending_checkout_session_id: 'cs_open_vehicle',
          status: 'Approved',
        },
      })
    ).resolves.toEqual({
      retryKeySeed: null,
      session: {
        id: 'cs_open_vehicle',
        metadata: {
          application_id: '11111111-1111-4111-8111-111111111111',
          checkout_kind: 'vehicle',
          payment_link_version: '4',
        },
        status: 'open',
        url: 'https://checkout.stripe.com/pay/cs_open_vehicle',
      },
    });
  });
});
