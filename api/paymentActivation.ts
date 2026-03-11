import Stripe from 'stripe';

import { db } from './db/index.js';
import {
  getApplicationSelectColumns,
  getCarSelectColumns,
  getRentalApplicationIdColumn,
  getRentalCarIdColumn,
  getSchemaCompat,
  toApplicationPaymentWritePayload,
  toRentalWritePayload,
} from './schemaCompat.js';
import { getTodayInAustralia } from '../shared/applicationSubmission.js';

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

export const getRentalStatusUpdatePayload = async (status: string, endDate?: string) => {
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

export const updateRentalsBySubscriptionIdentity = async (
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

export const maybeMarkCarAvailable = async (carId: number) => {
  const { rentals } = await fetchExistingRentalsForCar(carId);
  const hasLiveRental = rentals.some((rental) => isLiveRentalStatus(rental.status));

  if (hasLiveRental) {
    return;
  }

  const { data: car, error: carError } = await db
    .from('cars')
    .select('id, status')
    .eq('id', carId)
    .single();

  if (carError || !car) {
    throw new Error(`Failed to fetch car ${carId} before availability release.`);
  }

  if (car.status !== 'Rented') {
    return;
  }

  const result = await db.from('cars').update({ status: 'Available' }).eq('id', carId);
  assertSupabaseWrite(result, 'Failed to mark car as available');
};

export const handleVehicleCheckoutCompletion = async (session: Stripe.Checkout.Session) => {
  const applicationId = Number(session.metadata?.application_id || 0);
  const carId = Number(session.metadata?.car_id || 0);
  const approvedWeeklyPrice = Number(session.metadata?.approved_weekly_price || 0);
  const approvedBond = Number(session.metadata?.approved_bond || 0);
  const sessionPaymentLinkVersion = Number(session.metadata?.payment_link_version || 0);
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id || null;

  if (!applicationId || !carId || !subscriptionId) {
    return;
  }

  const activeDate = getTodayInAustralia();

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

  const moveApplicationToManualReview = async (reason: string) => {
    await updateApplicationPaymentState({
      applicationId,
      paidAt: new Date().toISOString(),
      pendingCheckoutSessionId: session.id,
      status: 'Payment Review',
    });

    if (!process.env.RESEND_API_KEY) {
      return;
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@maplerentals.com.au';

      await resend.emails.send({
        from: 'Maple Rentals <noreply@maplerentals.com.au>',
        to: adminEmail,
        subject: `Manual review required for vehicle checkout ${session.id}`,
        html: `
          <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; color: #1a202c;">
            <h2 style="color: #D4AF37;">Manual Payment Review Required</h2>
            <p><strong>Application ID:</strong> ${applicationId}</p>
            <p><strong>Applicant:</strong> ${String(application.name)}</p>
            <p><strong>Vehicle:</strong> ${String(car.name)}</p>
            <p><strong>Checkout session:</strong> ${session.id}</p>
            <p><strong>Stripe subscription:</strong> ${subscriptionId}</p>
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send manual review alert email:', emailError);
    }
  };

  const applicationStatus = String(application.status || '');
  const assignedCarId = Number(application.assigned_car_id || 0);
  const pendingCheckoutSessionId = application.pending_checkout_session_id
    ? String(application.pending_checkout_session_id)
    : null;
  const sessionStillMatchesCurrentApproval =
    assignedCarId === carId &&
    sessionPaymentLinkVersion === Number(application.payment_link_version || 0);

  if (!sessionStillMatchesCurrentApproval) {
    await moveApplicationToManualReview(
      'Paid Stripe session no longer matches the latest approved vehicle assignment or payment link version.'
    );
    return;
  }

  if (
    applicationStatus !== 'Approved' &&
    applicationStatus !== 'Paid' &&
    applicationStatus !== 'Payment Review'
  ) {
    await moveApplicationToManualReview(
      `Paid Stripe session arrived while application ${applicationStatus || 'Unknown'} is not eligible for automatic activation.`
    );
    return;
  }

  if (
    applicationStatus === 'Payment Review' &&
    pendingCheckoutSessionId &&
    pendingCheckoutSessionId !== session.id
  ) {
    await moveApplicationToManualReview(
      `Stored payment review session ${pendingCheckoutSessionId} does not match checkout session ${session.id}.`
    );
    return;
  }

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

  const existingRentalSubscriptionId = compat.rentalStripeSubscriptionColumn
    ? String(existingRental?.[compat.rentalStripeSubscriptionColumn] || '')
    : '';

  if (
    applicationStatus === 'Paid' &&
    existingRental &&
    existingRentalSubscriptionId &&
    existingRentalSubscriptionId !== subscriptionId
  ) {
    console.warn(
      `Ignoring duplicate checkout completion ${session.id} because application ${applicationId} is already bound to subscription ${existingRentalSubscriptionId}.`
    );
    return;
  }

  if (blockingRental) {
    await moveApplicationToManualReview(
      `Vehicle ${carId} is already attached to another live rental.`
    );
    return;
  }

  if (!existingRental) {
    if (String(car.status) !== 'Available' && String(car.status) !== 'Rented') {
      await moveApplicationToManualReview(
        `Vehicle ${carId} is not available for activation while marked ${car.status}.`
      );
      return;
    }

    const rentalPayload = await toRentalWritePayload({
      application_id: applicationId,
      bond_paid: approvedBond,
      car_id: carId,
      start_date: activeDate,
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
    start_date: activeDate,
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
