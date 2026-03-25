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
const STALE_WEBHOOK_PROCESSING_WINDOW_MS = 5 * 60 * 1000;

const todayIsoDate = () => getTodayInAustralia();

type WebhookLedgerStatus = 'received' | 'processing' | 'processed' | 'failed';

type WebhookEventClaim =
  | { eventId: string; mode: 'owned' }
  | { eventId: string; mode: 'already_processed' }
  | { eventId: string; mode: 'in_flight' }
  | { eventId: null; mode: 'no_dedupe' };

const readLedgerRow = async (eventId: string) => {
  const { data, error } = await db
    .from('stripe_webhook_events')
    .select('id, status, received_at')
    .eq('stripe_event_id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to read Stripe webhook ledger row ${eventId}: ${error.message || 'Unknown error'}`
    );
  }

  return data as {
    id: number;
    received_at?: string | null;
    status?: WebhookLedgerStatus | null;
  } | null;
};

const canReclaimStaleProcessingEvent = (receivedAt?: string | null) => {
  if (!receivedAt) {
    return false;
  }

  const receivedAtMs = Date.parse(receivedAt);
  if (!Number.isFinite(receivedAtMs)) {
    return false;
  }

  return Date.now() - receivedAtMs >= STALE_WEBHOOK_PROCESSING_WINDOW_MS;
};

const claimLedgerForProcessing = async (eventId: string) => {
  const claimByStatus = async (status: 'received' | 'failed') => {
    const { data, error } = await db
      .from('stripe_webhook_events')
      .update({
        status: 'processing',
        error_message: null,
        processed_at: null,
      })
      .eq('stripe_event_id', eventId)
      .eq('status', status)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to claim Stripe webhook ledger row ${eventId} for processing: ${error.message || 'Unknown error'}`
      );
    }

    return Boolean(data?.id);
  };

  if (await claimByStatus('received')) {
    return true;
  }

  return claimByStatus('failed');
};

const reclaimStaleInFlightLedger = async (
  eventId: string,
  existingReceivedAt: string | null | undefined
) => {
  if (!canReclaimStaleProcessingEvent(existingReceivedAt)) {
    return false;
  }

  const { data, error } = await db
    .from('stripe_webhook_events')
    .update({
      error_message: null,
      received_at: new Date().toISOString(),
      status: 'processing',
    })
    .eq('stripe_event_id', eventId)
    .eq('status', 'processing')
    .eq('received_at', existingReceivedAt || '')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to reclaim stale Stripe webhook ledger row ${eventId}: ${error.message || 'Unknown error'}`
    );
  }

  return Boolean(data?.id);
};

const markLedgerProcessed = async (eventId: string) => {
  const { data, error } = await db
    .from('stripe_webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString(), error_message: null })
    .eq('stripe_event_id', eventId)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to mark Stripe webhook ledger row ${eventId} as processed: ${error.message || 'Unknown error'}`
    );
  }

  if (!data?.id) {
    const existing = await readLedgerRow(eventId);
    if (existing?.status === 'processed') {
      return;
    }

    throw new Error(
      `Stripe webhook ledger row ${eventId} was not in a processing state when finalizing.`
    );
  }
};

const markLedgerFailed = async (eventId: string, errorMessage: string) => {
  const { error } = await db
    .from('stripe_webhook_events')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('stripe_event_id', eventId)
    .eq('status', 'processing');

  if (error) {
    console.error(
      `Failed to mark Stripe webhook ledger row ${eventId} as failed:`,
      error
    );
  }
};

const claimWebhookEvent = async (event: Stripe.Event): Promise<WebhookEventClaim> => {
  const eventId = typeof event.id === 'string' ? event.id.trim() : '';
  if (!eventId) {
    console.warn(
      `Stripe webhook event for ${event.type} is missing a stable id; skipping dedupe ledger persistence.`
    );
    return { eventId: null, mode: 'no_dedupe' };
  }

  const { error } = await db.from('stripe_webhook_events').insert([
    {
      stripe_event_id: eventId,
      event_type: event.type,
      status: 'processing',
    },
  ]);

  if (!error) {
    return { eventId, mode: 'owned' };
  }

  const errorCode = String((error as { code?: string }).code || '');
  if (errorCode === STRIPE_WEBHOOK_DUPLICATE_ERROR_CODE) {
    const existing = await readLedgerRow(eventId);
    const existingStatus = existing?.status || null;

    if (existingStatus === 'processed') {
      return { eventId, mode: 'already_processed' };
    }

    if (existingStatus === 'processing') {
      if (await reclaimStaleInFlightLedger(eventId, existing?.received_at)) {
        return { eventId, mode: 'owned' };
      }

      return { eventId, mode: 'in_flight' };
    }

    const claimed = await claimLedgerForProcessing(eventId);
    if (claimed) {
      return { eventId, mode: 'owned' };
    }

    const refreshed = await readLedgerRow(eventId);
    if (refreshed?.status === 'processed') {
      return { eventId, mode: 'already_processed' };
    }

    if (refreshed?.status === 'processing') {
      return { eventId, mode: 'in_flight' };
    }

    throw new Error(
      `Unable to claim Stripe webhook event ${eventId}; current ledger status is ${String(refreshed?.status || 'unknown')}.`
    );
  }

  throw new Error(
    `Failed to persist Stripe webhook event ${eventId}: ${error.message || 'Unknown error'}`
  );
};

const shouldReleaseVehicleAfterSubscriptionDeletion = (subscription: Stripe.Subscription) =>
  subscription.cancellation_details?.reason === 'cancellation_requested';

const isMissingSubscriptionRentalIdentityError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes('No rental found for Stripe subscription') ||
    error.message.includes('missing a Stripe subscription identity column'));

const updateRentalBySubscriptionIdentityOrSkip = async (
  subscriptionId: string,
  metadata: Record<string, string | undefined>,
  payload: Record<string, unknown>
) => {
  try {
    await updateRentalsBySubscriptionIdentity(subscriptionId, metadata, payload);
  } catch (error) {
    if (isMissingSubscriptionRentalIdentityError(error)) {
      console.warn(
        `Ignoring subscription lifecycle webhook for ${subscriptionId} because no strict Stripe rental identity could be resolved.`
      );
      return;
    }

    throw error;
  }
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
    response.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  let webhookClaim: WebhookEventClaim = { eventId: null, mode: 'no_dedupe' };

  try {
    webhookClaim = await claimWebhookEvent(event);

    if (webhookClaim.mode === 'already_processed') {
      response.status(200).send('received');
      return;
    }

    if (webhookClaim.mode === 'in_flight') {
      // Return non-2xx so Stripe retries after the in-flight worker settles.
      response.status(409).send('Webhook event is currently processing');
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
          await updateRentalBySubscriptionIdentityOrSkip(
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

        await updateRentalBySubscriptionIdentityOrSkip(
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
          await updateRentalBySubscriptionIdentityOrSkip(
            subscriptionId,
            subscription.metadata,
            await getRentalStatusUpdatePayload('Overdue')
          );
        } else if (status === 'active') {
          await updateRentalBySubscriptionIdentityOrSkip(
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
    if (webhookClaim.mode === 'owned' && webhookClaim.eventId) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await markLedgerFailed(webhookClaim.eventId, message);
    }
    console.error(`Error processing webhook event ${event.type}:`, err);
    return response.status(500).send('Webhook processing failed');
  }

  if (webhookClaim.mode === 'owned' && webhookClaim.eventId) {
    try {
      await markLedgerProcessed(webhookClaim.eventId);
    } catch (err) {
      // The event processing itself already succeeded. Do not downgrade the
      // ledger state to failed here; return 500 so Stripe retries and we can
      // reconcile the ledger on a subsequent delivery.
      console.error(`Error finalizing webhook ledger event ${event.type}:`, err);
      return response.status(500).send('Webhook processing failed');
    }
  }

  response.status(200).send('received');
});

export default router;
