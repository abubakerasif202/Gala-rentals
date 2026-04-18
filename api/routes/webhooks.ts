import express from 'express';
import type Stripe from 'stripe';

import { getStripeClient } from '../stripeClient.js';
import { processStripeWebhookEvent } from '../services/stripeWebhookService.js';

const router = express.Router();
const getStripe = () => getStripeClient();

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
    const result = await processStripeWebhookEvent(event);
    response.status(result.status).send(result.body);
    return;
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    return response.status(500).send('Webhook processing failed');
  }
});

export default router;
