import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckoutSessionRetrieve = vi.hoisted(() => vi.fn());
const mockCheckoutSessionExpire = vi.hoisted(() => vi.fn());

vi.mock('../stripeClient.js', () => ({
  getStripeClient: () => ({
    checkout: {
      sessions: {
        expire: mockCheckoutSessionExpire,
        retrieve: mockCheckoutSessionRetrieve,
      },
    },
  }),
}));

import {
  buildHostedCheckoutSessionIdempotencyKey,
  buildSubscriptionLineItemsFromCatalog,
  expirePendingCheckoutSession,
  resolvePendingCheckoutSession,
} from './stripeCheckoutService.js';

describe('stripeCheckoutService checkout helpers', () => {
  beforeEach(() => {
    mockCheckoutSessionExpire.mockReset();
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

  it('reuses an open checkout session when it still matches the current application and has no car_id', async () => {
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

  it('does not reuse legacy open checkout sessions that still include car_id metadata', async () => {
    mockCheckoutSessionRetrieve.mockResolvedValueOnce({
      id: 'cs_open_legacy_vehicle',
      metadata: {
        application_id: '11111111-1111-4111-8111-111111111111',
        car_id: '1',
        checkout_kind: 'vehicle',
        payment_link_version: '4',
      },
      status: 'open',
      url: 'https://checkout.stripe.com/pay/cs_open_legacy_vehicle',
    });

    await expect(
      resolvePendingCheckoutSession({
        application: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'driver@example.com',
          name: 'Driver One',
          payment_link_version: 4,
          pending_checkout_session_id: 'cs_open_legacy_vehicle',
          status: 'Approved',
        },
      })
    ).resolves.toEqual({
      retryKeySeed: 'cs_open_legacy_vehicle',
      session: null,
    });
  });

  it('expires an open pending checkout session', async () => {
    mockCheckoutSessionRetrieve.mockResolvedValueOnce({
      id: 'cs_open_vehicle',
      status: 'open',
    });
    mockCheckoutSessionExpire.mockResolvedValueOnce({
      id: 'cs_open_vehicle',
      status: 'expired',
    });

    await expirePendingCheckoutSession('cs_open_vehicle');

    expect(mockCheckoutSessionRetrieve).toHaveBeenCalledWith('cs_open_vehicle');
    expect(mockCheckoutSessionExpire).toHaveBeenCalledWith('cs_open_vehicle');
  });

  it('does not expire a completed pending checkout session', async () => {
    mockCheckoutSessionRetrieve.mockResolvedValueOnce({
      id: 'cs_complete_vehicle',
      status: 'complete',
    });

    await expirePendingCheckoutSession('cs_complete_vehicle');

    expect(mockCheckoutSessionRetrieve).toHaveBeenCalledWith('cs_complete_vehicle');
    expect(mockCheckoutSessionExpire).not.toHaveBeenCalled();
  });

  it('builds one-time bond and setup items on the initial subscription invoice when amounts are non-zero', () => {
    const lineItems = buildSubscriptionLineItemsFromCatalog({
      billingBreakdown: {
        bond: 500,
        currency: 'AUD',
        initialRental: 250,
        recurringAmount: 250,
        recurringInterval: 'week',
        recurringIntervalCount: 1,
        recurringLabel: 'per week',
        setupFees: 75,
        upfrontDue: 825,
      },
      stripeCatalog: {
        onboardingSetup: {
          productId: 'prod_onboarding_setup',
          source: 'env',
        },
        securityBond: {
          productId: 'prod_security_bond',
          source: 'env',
        },
        weeklyRental: {
          productId: 'prod_weekly_rental',
          source: 'env',
        },
      },
    });

    const bondItem = lineItems.find(
      (item) => item.price_data?.product === 'prod_security_bond'
    );
    const setupItem = lineItems.find(
      (item) => item.price_data?.product === 'prod_onboarding_setup'
    );
    const recurringItem = lineItems.find(
      (item) => item.price_data?.product === 'prod_weekly_rental'
    );

    expect(lineItems).toHaveLength(3);
    expect(bondItem?.price_data?.unit_amount).toBe(50000);
    expect(bondItem?.price_data).not.toHaveProperty('recurring');
    expect(setupItem?.price_data?.unit_amount).toBe(7500);
    expect(setupItem?.price_data).not.toHaveProperty('recurring');
    expect(recurringItem?.price_data).toMatchObject({
      recurring: {
        interval: 'week',
        interval_count: 1,
      },
      unit_amount: 25000,
    });
  });
});
