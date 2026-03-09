import express from 'express';
import Stripe from 'stripe';
import { db } from '../db/index.js';
import { STRIPE_CONFIG } from '../constants.js';
import {
  getCarSelectColumns,
  getRentalApplicationIdColumn,
  getRentalCarIdColumn,
  getSchemaCompat,
  toRentalWritePayload,
} from '../schemaCompat.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', STRIPE_CONFIG);

const assertSupabaseWrite = (
  result: { error: { message?: string } | null } | null | undefined,
  context: string
) => {
  if (result?.error) {
    throw new Error(`${context}: ${result.error.message || 'Unknown Supabase error'}`);
  }
};

const isLiveRentalStatus = (status: unknown) => {
  const normalized = String(status || '').toLowerCase();
  return normalized !== 'completed' && normalized !== 'cancelled';
};

const getRentalStatusUpdatePayload = async (status: string, endDate?: string) => {
  const compat = await getSchemaCompat();
  const payload: Record<string, unknown> = { status };

  if (endDate) {
    payload[compat.coreMode === 'camel' ? 'endDate' : 'end_date'] = endDate;
  }

  return payload;
};

const updateRentalsBySubscriptionIdentity = async (
  subscriptionId: string,
  metadata: Record<string, string | undefined>,
  payload: Record<string, unknown>
) => {
  const compat = await getSchemaCompat();

  if (compat.rentalStripeSubscriptionColumn) {
    const result = await db
      .from('rentals')
      .update(payload)
      .eq(compat.rentalStripeSubscriptionColumn, subscriptionId);
    assertSupabaseWrite(result, 'Failed to update rental by subscription id');
    return;
  }

  if (!metadata.car_id || !metadata.application_id) {
    return;
  }

  const result = await db
    .from('rentals')
    .update(payload)
    .eq(await getRentalCarIdColumn(), Number(metadata.car_id))
    .eq(await getRentalApplicationIdColumn(), Number(metadata.application_id));
  assertSupabaseWrite(result, 'Failed to update rental by car/application id');
};

const fetchExistingRentalsForCar = async (carId: number) => {
  const compat = await getSchemaCompat();
  const rentalCarIdColumn = await getRentalCarIdColumn();
  const rentalApplicationIdColumn = await getRentalApplicationIdColumn();
  const existingRentalColumns = [
    'id',
    'status',
    rentalCarIdColumn,
    rentalApplicationIdColumn,
    compat.rentalStripeSubscriptionColumn,
  ]
    .filter((column): column is string => Boolean(column))
    .join(', ');
  const existingRentalResult = await db
    .from('rentals')
    .select(existingRentalColumns)
    .eq(rentalCarIdColumn, carId);

  if (existingRentalResult.error) {
    throw new Error(
      `Failed to inspect existing rentals: ${existingRentalResult.error.message || 'Unknown error'}`
    );
  }

  return {
    compat,
    rentalApplicationIdColumn,
    rentals: ((existingRentalResult.data || []) as unknown) as Array<Record<string, unknown>>,
  };
};

const maybeMarkCarAvailable = async (carId: number) => {
  const { rentals } = await fetchExistingRentalsForCar(carId);
  const hasLiveRental = rentals.some((rental) => isLiveRentalStatus(rental.status));

  if (hasLiveRental) {
    return;
  }

  const { data: car, error: carError } = await db.from('cars').select('id, status').eq('id', carId).single();

  if (carError || !car) {
    throw new Error(`Failed to fetch car ${carId} before availability release.`);
  }

  if (car.status !== 'Rented') {
    return;
  }

  const result = await db.from('cars').update({ status: 'Available' }).eq('id', carId);
  assertSupabaseWrite(result, 'Failed to mark car as available');
};

const handleVehicleCheckoutCompletion = async ({
  applicationId,
  carId,
  customerId,
  subscriptionId,
}: {
  applicationId: number;
  carId: number;
  customerId: string | null;
  subscriptionId: string | null;
}) => {
  const { compat, rentalApplicationIdColumn, rentals: existingRentals } =
    await fetchExistingRentalsForCar(carId);
  const existingRentalForSameSubscription =
    compat.rentalStripeSubscriptionColumn && subscriptionId
      ? existingRentals.find(
          (rental) => rental[compat.rentalStripeSubscriptionColumn!] === subscriptionId
        )
      : null;
  const existingRentalForApplication = existingRentals.find(
    (rental) => Number(rental[rentalApplicationIdColumn]) === applicationId
  );

  if (existingRentalForSameSubscription || existingRentalForApplication) {
    return;
  }

  const { data: car, error: carError } = await db
    .from('cars')
    .select(await getCarSelectColumns())
    .eq('id', carId)
    .single();

  if (carError || !car) {
    throw new Error(`Failed to fetch car ${carId} for rental activation.`);
  }

  const blockingRental = existingRentals.find((rental) => isLiveRentalStatus(rental.status));

  if (blockingRental) {
    throw new Error(`Vehicle ${carId} is already attached to another live rental.`);
  }

  if (car.status !== 'Available') {
    throw new Error(`Vehicle ${carId} is not available for activation while marked ${car.status}.`);
  }

  const rentalPayload = await toRentalWritePayload({
    car_id: carId,
    application_id: applicationId,
    start_date: new Date().toISOString().split('T')[0],
    weekly_price: Number(car.weekly_price) || 0,
    status: 'Active',
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
  });

  const rentalInsert = await db.from('rentals').insert([rentalPayload]);
  assertSupabaseWrite(rentalInsert, 'Failed to create rental after checkout completion');

  const carUpdate = await db.from('cars').update({ status: 'Rented' }).eq('id', carId);
  assertSupabaseWrite(carUpdate, 'Failed to mark car as rented');

  const applicationUpdate = await db
    .from('applications')
    .update({ status: 'Approved' })
    .eq('id', applicationId);
  assertSupabaseWrite(applicationUpdate, 'Failed to mark application as approved');

  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const [{ data: appData }, { data: carData }] = await Promise.all([
    db.from('applications').select('name, email').eq('id', applicationId).single(),
    db.from('cars').select('name').eq('id', carId).single(),
  ]);

  if (!appData || !carData) {
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Maple Rentals <noreply@maplerentals.com.au>',
      to: appData.email,
      subject: 'Rental Confirmed - Maple Rentals',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
          <h2 style="color: #D4AF37;">Lease Confirmed</h2>
          <p>Hi ${appData.name},</p>
          <p>Great news! Your payment for the <strong>${carData.name}</strong> has been successfully processed.</p>
          <p>Your rental is now <strong>Active</strong>. You can now arrange for vehicle collection as discussed.</p>
          <p><strong>Subscription ID:</strong> ${subscriptionId || 'Pending sync'}</p>
          <br>
          <p>Best regards,</p>
          <p><strong>The Maple Rentals Team</strong></p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('Failed to send rental confirmation email:', emailErr);
  }
};

const handleApplicationCheckoutCompletion = async (applicationId: number) => {
  const result = await db.from('applications').update({ status: 'Paid' }).eq('id', applicationId);
  assertSupabaseWrite(result, 'Failed to mark application as paid');
};

const handleCheckoutCompletion = async (session: Stripe.Checkout.Session) => {
  if (session.payment_status !== 'paid') {
    return;
  }

  const applicationId = Number(session.metadata?.application_id || 0);
  const carId = Number(session.metadata?.car_id || 0);
  const checkoutKind = session.metadata?.checkout_kind;

  if (!applicationId || !checkoutKind) {
    return;
  }

  if (checkoutKind === 'application') {
    await handleApplicationCheckoutCompletion(applicationId);
    return;
  }

  if (checkoutKind === 'vehicle' && carId) {
    await handleVehicleCheckoutCompletion({
      applicationId,
      carId,
      customerId:
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id || null,
      subscriptionId:
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || null,
    });
  }
};

router.post('/', express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Stripe Webhook Error: ${message}`);
    response.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.details_submitted) {
          const compat = await getSchemaCompat();
          const result = await db
            .from('merchants')
            .update(
              compat.merchantMode === 'camel'
                ? { onboardingStatus: 'active' }
                : { onboarding_status: 'active' }
            )
            .eq(
              compat.merchantMode === 'camel' ? 'stripeAccountId' : 'stripe_account_id',
              account.id
            );
          assertSupabaseWrite(result, 'Failed to update merchant onboarding status');
        }
        break;
      }
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompletion(session);
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

        await updateRentalsBySubscriptionIdentity(
          subscriptionId,
          subscription.metadata,
          await getRentalStatusUpdatePayload('Completed', new Date().toISOString().split('T')[0])
        );

        if (car_id) {
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
