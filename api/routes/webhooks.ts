import express from 'express';
import Stripe from 'stripe';
import { db } from '../db/index.js';
import { STRIPE_CONFIG } from '../constants.js';
import {
  getApplicationSelectColumns,
  getCarSelectColumns,
  getRentalApplicationIdColumn,
  getRentalCarIdColumn,
  getSchemaCompat,
  toApplicationPaymentWritePayload,
  toRentalWritePayload,
} from '../schemaCompat.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', STRIPE_CONFIG);

const assertSupabaseWrite = (
  result: { error: { code?: string; message?: string } | null } | null | undefined,
  context: string
) => {
  if (result?.error) {
    throw new Error(`${context}: ${result.error.message || 'Unknown Supabase error'}`);
  }
};

const isDuplicateWrite = (error: unknown) =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      String((error as { code?: string }).code || '') === '23505'
  );

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

const updateApplicationPaymentState = async ({
  applicationId,
  paidAt,
  pendingCheckoutSessionId,
  status,
}: {
  applicationId: number;
  paidAt?: string | null;
  pendingCheckoutSessionId?: string | null;
  status?: string;
}) => {
  const payload = await toApplicationPaymentWritePayload({
    paid_at: paidAt,
    pending_checkout_session_id: pendingCheckoutSessionId,
    status,
  });
  const result = await db.from('applications').update(payload).eq('id', applicationId);
  assertSupabaseWrite(result, 'Failed to update application payment state');
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
    'weekly_price',
    'bond_paid',
    rentalCarIdColumn,
    rentalApplicationIdColumn,
    compat.rentalStripeSubscriptionColumn,
    compat.rentalStripeCustomerColumn,
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

const handleVehicleCheckoutCompletion = async (session: Stripe.Checkout.Session) => {
  const applicationId = Number(session.metadata?.application_id || 0);
  const carId = Number(session.metadata?.car_id || 0);
  const approvedWeeklyPrice = Number(session.metadata?.approved_weekly_price || 0);
  const approvedBond = Number(session.metadata?.approved_bond || 0);
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id || null;

  if (!applicationId || !carId || !subscriptionId) {
    return;
  }

  const selectColumns = await getApplicationSelectColumns();
  const [applicationResult, carResult, existingRentalsResult] = await Promise.all([
    db.from('applications').select(selectColumns).eq('id', applicationId).single(),
    db.from('cars').select(await getCarSelectColumns()).eq('id', carId).single(),
    fetchExistingRentalsForCar(carId),
  ]);

  if (applicationResult.error || !applicationResult.data) {
    throw new Error(`Failed to fetch application ${applicationId} for payment completion.`);
  }

  if (carResult.error || !carResult.data) {
    throw new Error(`Failed to fetch car ${carId} for payment completion.`);
  }

  const application = applicationResult.data as unknown as Record<string, unknown>;
  const car = carResult.data as Record<string, unknown>;
  const { compat, rentalApplicationIdColumn, rentals: existingRentals } = existingRentalsResult;
  let existingRental =
    (compat.rentalStripeSubscriptionColumn
      ? existingRentals.find(
          (rental) => rental[compat.rentalStripeSubscriptionColumn!] === subscriptionId
        )
      : null) ||
    existingRentals.find((rental) => Number(rental[rentalApplicationIdColumn]) === applicationId) ||
    null;
  const blockingRental = existingRentals.find(
    (rental) =>
      isLiveRentalStatus(rental.status) &&
      Number(rental[rentalApplicationIdColumn]) !== applicationId
  );

  if (blockingRental) {
    throw new Error(`Vehicle ${carId} is already attached to another live rental.`);
  }

  if (!existingRental) {
    if (String(car.status) !== 'Available' && String(car.status) !== 'Rented') {
      throw new Error(`Vehicle ${carId} is not available for activation while marked ${car.status}.`);
    }

    const rentalPayload = await toRentalWritePayload({
      application_id: applicationId,
      bond_paid: approvedBond,
      car_id: carId,
      start_date: new Date().toISOString().split('T')[0],
      status: 'Active',
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      weekly_price: approvedWeeklyPrice,
    });

    const rentalInsert = await db.from('rentals').insert([rentalPayload]);
    if (rentalInsert.error && !isDuplicateWrite(rentalInsert.error)) {
      throw new Error(
        `Failed to create rental after checkout completion: ${rentalInsert.error.message || 'Unknown error'}`
      );
    }

    if (rentalInsert.error) {
      const refetchedRentals = await fetchExistingRentalsForCar(carId);
      existingRental =
        (compat.rentalStripeSubscriptionColumn
          ? refetchedRentals.rentals.find(
              (rental) => rental[compat.rentalStripeSubscriptionColumn!] === subscriptionId
            )
          : null) ||
        refetchedRentals.rentals.find(
          (rental) => Number(rental[rentalApplicationIdColumn]) === applicationId
        ) ||
        null;

      if (!existingRental) {
        throw new Error(
          `Rental insert reported a duplicate write, but no rental could be recovered for application ${applicationId}.`
        );
      }
    }
  }

  const rentalUpdatePayload = await toRentalWritePayload({
    application_id: applicationId,
    bond_paid: approvedBond,
    car_id: carId,
    start_date: new Date().toISOString().split('T')[0],
    status: 'Active',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    weekly_price: approvedWeeklyPrice,
  });
  const {
    startDate: _unusedCamelStartDate,
    start_date: _unusedSnakeStartDate,
    carId: _unusedCamelCarId,
    car_id: _unusedSnakeCarId,
    applicationId: _unusedCamelApplicationId,
    application_id: _unusedSnakeApplicationId,
    ...repairPayload
  } = rentalUpdatePayload as unknown as Record<string, unknown>;

  if (existingRental) {
    const result = await db.from('rentals').update(repairPayload).eq('id', existingRental.id);
    assertSupabaseWrite(result, 'Failed to repair existing rental after checkout completion');
  }

  const carUpdate = await db.from('cars').update({ status: 'Rented' }).eq('id', carId);
  assertSupabaseWrite(carUpdate, 'Failed to mark car as rented');

  await updateApplicationPaymentState({
    applicationId,
    paidAt: new Date().toISOString(),
    pendingCheckoutSessionId: null,
    status: 'Paid',
  });

  if (!process.env.RESEND_API_KEY || String(application.status) === 'Paid') {
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Maple Rentals <noreply@maplerentals.com.au>',
      to: String(application.email),
      subject: 'Rental Confirmed - Maple Rentals',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
          <h2 style="color: #D4AF37;">Payment Confirmed</h2>
          <p>Hi ${String(application.name)},</p>
          <p>Your payment for the <strong>${String(car.name)}</strong> has been successfully processed.</p>
          <p>Your rental is now <strong>Active</strong>. We will contact you shortly with collection details.</p>
          <p><strong>Subscription ID:</strong> ${subscriptionId}</p>
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
