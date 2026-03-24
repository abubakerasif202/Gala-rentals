import express from 'express';
import type Stripe from 'stripe';

import { db } from '../db/index.js';
import { getStripeClient } from '../stripeClient.js';
import {
  getRentalStatusUpdatePayload,
  handleVehicleCheckoutCompletion,
  maybeMarkCarAvailable,
  updateRentalsBySubscriptionIdentity,
} from '../paymentActivation.js';
import { getTodayInAustralia } from '../../shared/applicationSubmission.js';

const router = express.Router();
const getStripe = () => getStripeClient();

const STRIPE_WEBHOOK_DUPLICATE_ERROR_CODE = '23505';

const todayIsoDate = () => getTodayInAustralia();

const persistWebhookEventIfNew = async (event: Stripe.Event) => {
  const eventId = typeof event.id === 'string' ? event.id.trim() : '';
  if (!eventId) {
    console.warn(
      `Stripe webhook event for ${event.type} is missing a stable id; skipping dedupe ledger persistence.`
    );
    return { isDuplicate: false as const, persisted: false as const };
  }

  const { error } = await db.from('stripe_webhook_events').insert([
    {
      stripe_event_id: eventId,
      event_type: event.type,
    },
  ]);

  if (!error) {
    return { isDuplicate: false as const, persisted: true as const };
  }

  const errorCode = String((error as { code?: string }).code || '');
  if (errorCode === STRIPE_WEBHOOK_DUPLICATE_ERROR_CODE) {
    return { isDuplicate: true as const, persisted: false as const };
  }

  throw new Error(
    `Failed to persist Stripe webhook event ${eventId}: ${error.message || 'Unknown error'}`
  );
};

const shouldReleaseVehicleAfterSubscriptionDeletion = (subscription: Stripe.Subscription) =>
  subscription.cancellation_details?.reason === 'cancellation_requested';

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
    response.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
    const webhookEventState = await persistWebhookEventIfNew(event);
    if (webhookEventState.isDuplicate) {
      response.status(200).send('received');
      return;
    }

    switch (event.type) {
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === 'paid' && session.metadata?.checkout_kind === 'vehicle') {
          await handleVehicleCheckoutCompletion(session);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionReference = (
          invoice as Stripe.Invoice & {
            subscription?: string | Stripe.Subscription | null;
          }
        ).subscription;
        const subscriptionId =
          typeof subscriptionReference === 'string'
            ? subscriptionReference
            : subscriptionReference?.id || null;

        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await updateRentalsBySubscriptionIdentity(
            subscriptionId,
            subscription.metadata,
            await getRentalStatusUpdatePayload('Overdue')
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const { car_id } = subscription.metadata;
        const shouldReleaseVehicle = shouldReleaseVehicleAfterSubscriptionDeletion(subscription);
        const nextRentalStatus = shouldReleaseVehicle ? 'Completed' : 'Cancelled';

        await updateRentalsBySubscriptionIdentity(
          subscriptionId,
          subscription.metadata,
          await getRentalStatusUpdatePayload(nextRentalStatus, todayIsoDate())
        );

        if (car_id && shouldReleaseVehicle) {
          await maybeMarkCarAvailable(Number(car_id));
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const status = subscription.status;

        if (status === 'past_due' || status === 'unpaid') {
          await updateRentalsBySubscriptionIdentity(
            subscriptionId,
            subscription.metadata,
            await getRentalStatusUpdatePayload('Overdue')
          );
        } else if (status === 'active') {
          await updateRentalsBySubscriptionIdentity(
            subscriptionId,
            subscription.metadata,
            await getRentalStatusUpdatePayload('Active')
          );
        }
        break;
      }
      default:
        console.log(`Stripe Webhook: unhandled event type ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    return response.status(500).send('Webhook processing failed');
  }

  response.status(200).send('received');
});

export default router;
