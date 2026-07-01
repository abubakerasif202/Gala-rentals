import crypto from 'node:crypto';

import express from 'express';
import type Stripe from 'stripe';

import { getStripeClient } from '../stripeClient.js';
import { processStripeWebhookEvent } from '../services/stripeWebhookService.js';

const router = express.Router();
const getStripe = () => getStripeClient();

const hashStripeWebhookPayload = (payload: unknown) => {
  if (Buffer.isBuffer(payload)) {
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  if (typeof payload === 'string') {
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  return null;
};

const getSafeStripeEventLogContext = (event: Stripe.Event) => {
  const payload = event.data.object as
    | { id?: unknown; metadata?: Record<string, unknown> | null }
    | undefined;
  const metadata =
    payload?.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : null;

  return {
    metadataKeys: metadata ? Object.keys(metadata).sort() : [],
    stripeEventId: event.id,
    stripeEventType: event.type,
    stripeObjectId: typeof payload?.id === 'string' ? payload.id : null,
  };
};

router.post('/', async (request, response) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook secret is not configured.');
    response.status(503).send('Webhook configuration missing');
    return;
  }

  const sigHeader = request.headers['stripe-signature'];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  if (!sig) {
    response.status(400).send('Missing Stripe signature');
    return;
  }
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Stripe Webhook Error: ${message}`);
    response.status(400).send('400 Bad Request: Invalid Signature');
    return;
  }

  try {
    const result = await processStripeWebhookEvent(
      event,
      hashStripeWebhookPayload(request.body)
    );
    response.status(result.status).send(result.body);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook processing failed', {
      ...getSafeStripeEventLogContext(event),
      errorMessage: message,
      errorName: err instanceof Error ? err.name : 'UnknownError',
    });
    return response.status(500).send('Webhook processing failed');
  }
});

export default router;
