import { describe, expect, it } from 'vitest';

import {
  buildStripeWebhookWorkItem,
  classifyWebhookProcessingError,
} from './stripeWebhookService.js';

describe('stripeWebhookService queue-ready boundaries', () => {
  it('normalizes checkout session metadata into a deterministic work item', () => {
    const workItem = buildStripeWebhookWorkItem({
      data: {
        object: {
          id: 'cs_test_123',
          metadata: {
            application_id: '11111111-1111-4111-8111-111111111111',
            car_id: '7',
            checkout_kind: 'vehicle',
            payment_link_version: '4',
          },
          payment_status: 'paid',
        },
      },
      id: 'evt_test_123',
      type: 'checkout.session.completed',
    } as never);

    expect(workItem).toEqual({
      applicationId: '11111111-1111-4111-8111-111111111111',
      carId: 7,
      checkoutKind: 'vehicle',
      checkoutSessionId: 'cs_test_123',
      eventId: 'evt_test_123',
      eventType: 'checkout.session.completed',
      paymentLinkVersion: 4,
      paymentStatus: 'paid',
      processingSource: 'webhook-route',
    });
  });

  it('classifies webhook failures into the current retry classes', () => {
    expect(
      classifyWebhookProcessingError(
        Object.assign(new Error('temporary Stripe connection lost'), {
          type: 'StripeConnectionError',
        })
      )
    ).toBe('transient');

    expect(
      classifyWebhookProcessingError(
        Object.assign(new Error('No such subscription: sub_missing'), {
          statusCode: 404,
          type: 'StripeInvalidRequestError',
        })
      )
    ).toBe('permanent');

    expect(
      classifyWebhookProcessingError(new Error('payment link version changed'))
    ).toBe('business_blocked');
  });
});
