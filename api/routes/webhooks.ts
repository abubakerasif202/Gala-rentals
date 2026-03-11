import express from 'express';
import Stripe from 'stripe';

import { STRIPE_CONFIG } from '../constants.js';
import {
  getRentalStatusUpdatePayload,
  handleVehicleCheckoutCompletion,
  maybeMarkCarAvailable,
  updateRentalsBySubscriptionIdentity,
} from '../paymentActivation.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', STRIPE_CONFIG);

const todayIsoDate = () => new Date().toISOString().split('T')[0];

const shouldReleaseVehicleAfterSubscriptionDeletion = (subscription: Stripe.Subscription) =>
  subscription.cancellation_details?.reason === 'cancellation_requested';

router.post('/', express.raw({ type: 'application/json' }), async (request, response) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook secret is not configured.');
    response.status(503).send('Webhook configuration missing');
    return;
  }

  const sig = request.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Stripe Webhook Error: ${message}`);
    response.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
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
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
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

        if (shouldReleaseVehicle && car_id) {
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
