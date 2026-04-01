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
const LEGACY_WEBHOOK_PROCESSING_PREFIX = 'processing:';

const todayIsoDate = () => getTodayInAustralia();

type WebhookLedgerMode = 'modern' | 'legacy';
type WebhookLedgerStatus = 'received' | 'processing' | 'processed' | 'failed';

type WebhookEventClaim =
  | { eventId: string; ledgerMode: WebhookLedgerMode; mode: 'owned' }
  | { eventId: string; ledgerMode: WebhookLedgerMode; mode: 'already_processed' }
  | { eventId: string; ledgerMode: WebhookLedgerMode; mode: 'in_flight' };

type ModernWebhookLedgerRow = {
  id: number;
  received_at?: string | null;
  status?: WebhookLedgerStatus | null;
};

type LegacyWebhookLedgerRow = {
  event_type?: string | null;
  id: number;
  processed_at?: string | null;
};

let preferredWebhookLedgerMode: WebhookLedgerMode | null = null;

const setPreferredWebhookLedgerMode = (mode: WebhookLedgerMode) => {
  preferredWebhookLedgerMode = mode;
  return mode;
};

const toLegacyProcessingEventType = (eventType: string) =>
  `${LEGACY_WEBHOOK_PROCESSING_PREFIX}${eventType}`;

const isLegacyProcessingEventType = (eventType: string | null | undefined) =>
  typeof eventType === 'string' && eventType.startsWith(LEGACY_WEBHOOK_PROCESSING_PREFIX);

const isMissingLegacyLedgerColumnsError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = String((error as { code?: string }).code || '').toUpperCase();
  const combinedMessage = [
    String((error as { message?: string }).message || ''),
    String((error as { details?: string }).details || ''),
    String((error as { hint?: string }).hint || ''),
  ]
    .join(' ')
    .toLowerCase();

  if (
    code !== 'PGRST204' &&
    code !== '42703' &&
    !combinedMessage.includes('column') &&
    !combinedMessage.includes('schema cache')
  ) {
    return false;
  }

  return (
    combinedMessage.includes('stripe_webhook_events') &&
    ['status', 'received_at', 'error_message'].some((columnName) =>
      combinedMessage.includes(columnName)
    )
  );
};

const readModernLedgerRow = async (eventId: string) => {
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

  return data as ModernWebhookLedgerRow | null;
};

const readLegacyLedgerRow = async (eventId: string) => {
  const { data, error } = await db
    .from('stripe_webhook_events')
    .select('id, event_type, processed_at')
    .eq('stripe_event_id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to read legacy Stripe webhook ledger row ${eventId}: ${error.message || 'Unknown error'}`
    );
  }

  return data as LegacyWebhookLedgerRow | null;
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

const claimModernLedgerForProcessing = async (eventId: string) => {
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

const reclaimStaleModernInFlightLedger = async (
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

const markModernLedgerProcessed = async (eventId: string) => {
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
    const existing = await readModernLedgerRow(eventId);
    if (existing?.status === 'processed') {
      return;
    }

    throw new Error(
      `Stripe webhook ledger row ${eventId} was not in a processing state when finalizing.`
    );
  }
};

const markModernLedgerFailed = async (eventId: string, errorMessage: string) => {
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

const reclaimStaleLegacyLedgerClaim = async ({
  eventId,
  existingEventType,
  existingProcessedAt,
  processingEventType,
}: {
  eventId: string;
  existingEventType: string;
  existingProcessedAt: string | null | undefined;
  processingEventType: string;
}) => {
  if (!existingProcessedAt || !canReclaimStaleProcessingEvent(existingProcessedAt)) {
    return false;
  }

  const { data, error } = await db
    .from('stripe_webhook_events')
    .update({
      event_type: processingEventType,
      processed_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId)
    .eq('event_type', existingEventType)
    .eq('processed_at', existingProcessedAt)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to reclaim stale legacy Stripe webhook ledger row ${eventId}: ${error.message || 'Unknown error'}`
    );
  }

  return Boolean(data?.id);
};

const markLegacyLedgerProcessed = async (eventId: string, eventType: string) => {
  const processingEventType = toLegacyProcessingEventType(eventType);
  const { data, error } = await db
    .from('stripe_webhook_events')
    .update({
      event_type: eventType,
      processed_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId)
    .eq('event_type', processingEventType)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to mark legacy Stripe webhook ledger row ${eventId} as processed: ${error.message || 'Unknown error'}`
    );
  }

  if (!data?.id) {
    const existing = await readLegacyLedgerRow(eventId);
    if (existing?.event_type === eventType) {
      return;
    }

    throw new Error(
      `Legacy Stripe webhook ledger row ${eventId} was not in a processing state when finalizing.`
    );
  }
};

const markLegacyLedgerFailed = async (eventId: string, eventType: string) => {
  const processingEventType = toLegacyProcessingEventType(eventType);
  const { error } = await db
    .from('stripe_webhook_events')
    .delete()
    .eq('stripe_event_id', eventId)
    .eq('event_type', processingEventType);

  if (error) {
    console.error(
      `Failed to remove legacy Stripe webhook ledger row ${eventId} after a processing error:`,
      error
    );
  }
};

const getWebhookEventId = (event: Stripe.Event) => {
  const eventId = typeof event.id === 'string' ? event.id.trim() : '';
  if (!eventId) {
    throw new Error(`Stripe webhook event ${event.type} is missing a stable id.`);
  }

  return eventId;
};

const claimModernWebhookEvent = async (
  eventId: string,
  eventType: string
): Promise<WebhookEventClaim> => {
  const { error } = await db.from('stripe_webhook_events').insert([
    {
      stripe_event_id: eventId,
      event_type: eventType,
      status: 'processing',
    },
  ]);

  if (!error) {
    return {
      eventId,
      ledgerMode: setPreferredWebhookLedgerMode('modern'),
      mode: 'owned',
    };
  }

  const errorCode = String((error as { code?: string }).code || '');
  if (errorCode === STRIPE_WEBHOOK_DUPLICATE_ERROR_CODE) {
    const existing = await readModernLedgerRow(eventId);
    const existingStatus = existing?.status || null;

    if (existingStatus === 'processed') {
      return {
        eventId,
        ledgerMode: setPreferredWebhookLedgerMode('modern'),
        mode: 'already_processed',
      };
    }

    if (existingStatus === 'processing') {
      if (await reclaimStaleModernInFlightLedger(eventId, existing?.received_at)) {
        return {
          eventId,
          ledgerMode: setPreferredWebhookLedgerMode('modern'),
          mode: 'owned',
        };
      }

      return {
        eventId,
        ledgerMode: setPreferredWebhookLedgerMode('modern'),
        mode: 'in_flight',
      };
    }

    const claimed = await claimModernLedgerForProcessing(eventId);
    if (claimed) {
      return {
        eventId,
        ledgerMode: setPreferredWebhookLedgerMode('modern'),
        mode: 'owned',
      };
    }

    const refreshed = await readModernLedgerRow(eventId);
    if (refreshed?.status === 'processed') {
      return {
        eventId,
        ledgerMode: setPreferredWebhookLedgerMode('modern'),
        mode: 'already_processed',
      };
    }

    if (refreshed?.status === 'processing') {
      return {
        eventId,
        ledgerMode: setPreferredWebhookLedgerMode('modern'),
        mode: 'in_flight',
      };
    }

    throw new Error(
      `Unable to claim Stripe webhook event ${eventId}; current ledger status is ${String(refreshed?.status || 'unknown')}.`
    );
  }

  throw new Error(
    `Failed to persist Stripe webhook event ${eventId}: ${error.message || 'Unknown error'}`
  );
};

const claimLegacyWebhookEvent = async (
  eventId: string,
  eventType: string
): Promise<WebhookEventClaim> => {
  const processingEventType = toLegacyProcessingEventType(eventType);
  const { error } = await db.from('stripe_webhook_events').insert([
    {
      stripe_event_id: eventId,
      event_type: processingEventType,
      processed_at: new Date().toISOString(),
    },
  ]);

  if (!error) {
    return {
      eventId,
      ledgerMode: setPreferredWebhookLedgerMode('legacy'),
      mode: 'owned',
    };
  }

  const errorCode = String((error as { code?: string }).code || '');
  if (errorCode === STRIPE_WEBHOOK_DUPLICATE_ERROR_CODE) {
    const existing = await readLegacyLedgerRow(eventId);
    const existingEventType = String(existing?.event_type || '');

    if (!isLegacyProcessingEventType(existingEventType)) {
      return {
        eventId,
        ledgerMode: setPreferredWebhookLedgerMode('legacy'),
        mode: 'already_processed',
      };
    }

    if (
      await reclaimStaleLegacyLedgerClaim({
        eventId,
        existingEventType,
        existingProcessedAt: existing?.processed_at,
        processingEventType,
      })
    ) {
      return {
        eventId,
        ledgerMode: setPreferredWebhookLedgerMode('legacy'),
        mode: 'owned',
      };
    }

    return {
      eventId,
      ledgerMode: setPreferredWebhookLedgerMode('legacy'),
      mode: 'in_flight',
    };
  }

  throw new Error(
    `Failed to persist legacy Stripe webhook event ${eventId}: ${error.message || 'Unknown error'}`
  );
};

const claimWebhookEvent = async (event: Stripe.Event): Promise<WebhookEventClaim> => {
  const eventId = getWebhookEventId(event);

  if (preferredWebhookLedgerMode === 'legacy') {
    return claimLegacyWebhookEvent(eventId, event.type);
  }

  try {
    return await claimModernWebhookEvent(eventId, event.type);
  } catch (error) {
    if (isMissingLegacyLedgerColumnsError(error)) {
      return claimLegacyWebhookEvent(eventId, event.type);
    }

    throw error;
  }
};

const markLedgerProcessed = async (claim: WebhookEventClaim, eventType: string) => {
  if (claim.ledgerMode === 'legacy') {
    await markLegacyLedgerProcessed(claim.eventId, eventType);
    return;
  }

  await markModernLedgerProcessed(claim.eventId);
};

const markLedgerFailed = async (
  claim: WebhookEventClaim,
  eventType: string,
  errorMessage: string
) => {
  if (claim.ledgerMode === 'legacy') {
    await markLegacyLedgerFailed(claim.eventId, eventType);
    return;
  }

  await markModernLedgerFailed(claim.eventId, errorMessage);
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

  let webhookClaim: WebhookEventClaim | null = null;

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
    if (webhookClaim?.mode === 'owned' && webhookClaim.eventId) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await markLedgerFailed(webhookClaim, event.type, message);
    }
    console.error(`Error processing webhook event ${event.type}:`, err);
    return response.status(500).send('Webhook processing failed');
  }

  if (webhookClaim?.mode === 'owned' && webhookClaim.eventId) {
    try {
      await markLedgerProcessed(webhookClaim, event.type);
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
