import Stripe from 'stripe';

import { FALLBACK_ADMIN_EMAIL } from './constants.js';
import { db } from './db/index.js';
import {
  hasDirectDatabaseConnection,
  withPostgresAdvisoryLock,
  withPostgresTransaction,
} from './db/postgres.js';
import { transitionApplicationToPaymentReviewIfCurrentVersion } from './applicationPaymentState.js';
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
import { escapeHtml, getResend, sendResendEmail } from './email.js';
import {
  AUTOMATIC_PAYMENT_ACTIVATION_RESTRICTED_REASON,
  hasTransactionalPaymentProcessing,
} from './paymentProcessing.js';
import { normalizeUuid } from '../shared/uuid.js';

const VEHICLE_CHECKOUT_FULFILLMENT_EVENT_TYPE =
  'vehicle_checkout.fulfillment.processed';

const buildVehicleCheckoutFulfillmentLedgerId = (sessionId: string) =>
  `fulfill:vehicle-checkout:${sessionId}`;

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
  expectedPaymentLinkVersion,
  paidAt,
  pendingCheckoutSessionId,
  status,
}: {
  applicationId: string;
  expectedPaymentLinkVersion?: number;
  paidAt?: string | null;
  pendingCheckoutSessionId?: string | null;
  status?: string;
}) => {
  if (
    status === 'Payment Review' &&
    typeof expectedPaymentLinkVersion === 'number'
  ) {
    return transitionApplicationToPaymentReviewIfCurrentVersion({
      applicationId,
      paidAt,
      pendingCheckoutSessionId,
    });
  }

  const payload = await toApplicationPaymentWritePayload({
    paid_at: paidAt,
    pending_checkout_session_id: pendingCheckoutSessionId,
    status,
  });
  const result = await db.from('applications').update(payload).eq('id', applicationId);
  assertSupabaseWrite(result, 'Failed to update application payment state');
  return null;
};

export const updateRentalsBySubscriptionIdentity = async (
  subscriptionId: string,
  metadata: Record<string, string | undefined>,
  payload: Record<string, unknown>
) => {
  const compat = await getSchemaCompat();

  if (!compat.rentalStripeSubscriptionColumn) {
    throw new Error(
      'Rental schema is missing a Stripe subscription identity column; refusing fallback rental updates.'
    );
  }

  const { data: rentalBySubscription, error: rentalBySubscriptionError } = await db
    .from('rentals')
    .select('id')
    .eq(compat.rentalStripeSubscriptionColumn, subscriptionId)
    .maybeSingle();

  if (rentalBySubscriptionError) {
    throw new Error(
      `Failed to inspect rental by subscription id: ${rentalBySubscriptionError.message || 'Unknown error'}`
    );
  }

  if (!rentalBySubscription?.id) {
    const safeApplicationId = typeof metadata.application_id === 'string'
      ? normalizeUuid(metadata.application_id)
      : null;
    const safeCarId = Number(metadata.car_id || 0) || null;
    throw new Error(
      `No rental found for Stripe subscription ${subscriptionId}. ` +
        `Refusing fallback update for application=${String(safeApplicationId)} car=${String(safeCarId)}.`
    );
  }

  const result = await db.from('rentals').update(payload).eq('id', rentalBySubscription.id);
  assertSupabaseWrite(result, 'Failed to update rental by subscription id');
};

const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export const buildLockedApplicationSelectSql = async () => {
  const {
    applicationAssignedCarColumn,
    applicationPaymentLinkVersionColumn,
  } = await getSchemaCompat();

  return (
    `SELECT status, ` +
    `${quoteIdentifier(applicationPaymentLinkVersionColumn)} AS payment_link_version, ` +
    `${quoteIdentifier(applicationAssignedCarColumn)} AS assigned_car_id ` +
    `FROM ${quoteIdentifier('applications')} WHERE id = $1 FOR UPDATE`
  );
};

export const withVehicleCheckoutProcessingLock = async <T>(
  applicationId: string,
  callback: () => Promise<T>
) => {
  if (!hasDirectDatabaseConnection()) {
    return callback();
  }

  return withPostgresAdvisoryLock(`vehicle-checkout:${applicationId}`, callback);
};

const stripRentalIdentityFields = (payload: Record<string, unknown>) => {
  const {
    startDate: _unusedCamelStartDate,
    start_date: _unusedSnakeStartDate,
    carId: _unusedCamelCarId,
    car_id: _unusedSnakeCarId,
    applicationId: _unusedCamelApplicationId,
    application_id: _unusedSnakeApplicationId,
    ...repairPayload
  } = payload;

  return repairPayload;
};

const insertRowInTransaction = async (
  client: import('pg').PoolClient,
  table: string,
  payload: Record<string, unknown>
) => {
  const entries = Object.entries(payload);
  const columns = entries.map(([column]) => quoteIdentifier(column)).join(', ');
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await client.query(
    `INSERT INTO ${quoteIdentifier(table)} (${columns}) VALUES (${placeholders})`,
    values
  );

  if (result.rowCount !== 1) {
    throw new Error(`Failed to insert ${table} row within transaction.`);
  }
};

const updateRowByIdInTransaction = async (
  client: import('pg').PoolClient,
  table: string,
  id: number | string,
  payload: Record<string, unknown>,
  context: string
) => {
  const entries = Object.entries(payload);
  const setClauses = entries
    .map(([column], index) => `${quoteIdentifier(column)} = $${index + 1}`)
    .join(', ');
  const values = [...entries.map(([, value]) => value), id];

  const result = await client.query(
    `UPDATE ${quoteIdentifier(table)} SET ${setClauses} WHERE id = $${entries.length + 1}`,
    values
  );

  if (result.rowCount !== 1) {
    throw new Error(context);
  }
};

const readVehicleCheckoutFulfillmentMarkerInTransaction = async (
  client: import('pg').PoolClient,
  sessionId: string
) =>
  client.query(
    'SELECT id, event_type FROM stripe_webhook_events WHERE stripe_event_id = $1 FOR UPDATE',
    [buildVehicleCheckoutFulfillmentLedgerId(sessionId)]
  );

const persistVehicleCheckoutFulfillmentMarkerInTransaction = async (
  client: import('pg').PoolClient,
  sessionId: string,
  existingLedgerRowId: number | null
) => {
  const ledgerId = buildVehicleCheckoutFulfillmentLedgerId(sessionId);
  const processedAt = new Date().toISOString();

  if (existingLedgerRowId) {
    await updateRowByIdInTransaction(
      client,
      'stripe_webhook_events',
      existingLedgerRowId,
      {
        event_type: VEHICLE_CHECKOUT_FULFILLMENT_EVENT_TYPE,
        processed_at: processedAt,
      },
      'Failed to update vehicle checkout fulfillment marker'
    );
    return;
  }

  const result = await client.query(
    'INSERT INTO "stripe_webhook_events" ("stripe_event_id", "event_type", "processed_at") VALUES ($1, $2, $3)',
    [ledgerId, VEHICLE_CHECKOUT_FULFILLMENT_EVENT_TYPE, processedAt]
  );

  if (result.rowCount !== 1) {
    throw new Error('Failed to persist vehicle checkout fulfillment marker.');
  }
};

const hasVehicleCheckoutFulfillmentMarker = async (sessionId: string) => {
  const { data, error } = await db
    .from('stripe_webhook_events')
    .select('id, event_type')
    .eq('stripe_event_id', buildVehicleCheckoutFulfillmentLedgerId(sessionId))
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to read vehicle checkout fulfillment marker ${sessionId}: ${error.message || 'Unknown error'}`
    );
  }

  return data?.event_type === VEHICLE_CHECKOUT_FULFILLMENT_EVENT_TYPE;
};

const applyVehicleCheckoutActivationWrites = async ({
  applicationId,
  carId,
  existingRentalId,
  expectedPaymentLinkVersion,
  fulfillmentSessionId,
  paidAt,
  rentalInsertPayload,
  rentalRepairPayload,
}: {
  applicationId: string;
  carId: number;
  existingRentalId: number | null;
  expectedPaymentLinkVersion: number;
  fulfillmentSessionId: string;
  paidAt: string;
  rentalInsertPayload: Record<string, unknown>;
  rentalRepairPayload: Record<string, unknown>;
}) => {
  const applicationPaymentPayload = await toApplicationPaymentWritePayload({
    paid_at: paidAt,
    pending_checkout_session_id: null,
    status: 'Paid',
  });

  if (!hasDirectDatabaseConnection()) {
    throw new Error(
      'Automatic payment activation requires a session-capable Postgres connection.'
    );
  }

  return withPostgresTransaction(async (client) => {
    const fulfillmentLedgerResult =
      await readVehicleCheckoutFulfillmentMarkerInTransaction(
        client,
        fulfillmentSessionId
      );
    const existingFulfillmentLedgerRow =
      (fulfillmentLedgerResult.rows[0] as
        | { event_type?: string | null; id?: number | null }
        | undefined) || undefined;

    if (
      existingFulfillmentLedgerRow?.event_type ===
      VEHICLE_CHECKOUT_FULFILLMENT_EVENT_TYPE
    ) {
      return 'already_fulfilled' as const;
    }

    const applicationRes = await client.query(
      await buildLockedApplicationSelectSql(),
      [applicationId]
    );

    const lockedApplicationRow = applicationRes.rows[0] as
      | {
          assigned_car_id?: number | string | null;
          payment_link_version?: number | string | null;
          status?: string | null;
        }
      | undefined;

    if (!lockedApplicationRow) {
      throw new Error(`Application ${applicationId} disappeared while activating payment.`);
    }

    const lockedAssignedCarId = Number(lockedApplicationRow.assigned_car_id || 0);
    if (lockedAssignedCarId !== carId) {
      throw new Error(
        `Application ${applicationId} is no longer assigned to car ${carId}; activation requires manual review.`
      );
    }

    const lockedPaymentLinkVersion = Number(lockedApplicationRow.payment_link_version || 0);
    if (lockedPaymentLinkVersion !== expectedPaymentLinkVersion) {
      throw new Error(
        `Application ${applicationId} payment link version changed from ${expectedPaymentLinkVersion} to ${lockedPaymentLinkVersion}.`
      );
    }

    const lockedApplicationStatus = String(lockedApplicationRow.status || '');
    if (
      lockedApplicationStatus !== 'Approved' &&
      lockedApplicationStatus !== 'Paid' &&
      lockedApplicationStatus !== 'Payment Review'
    ) {
      throw new Error(
        `Application ${applicationId} cannot be activated from status ${lockedApplicationStatus || 'Unknown'}.`
      );
    }

    // Lock the car row and re-validate availability inside the transaction
    const carRes = await client.query(
      'SELECT status FROM cars WHERE id = $1 FOR UPDATE',
      [carId]
    );
    const currentCarStatus = carRes.rows[0]?.status;

    if (!existingRentalId && currentCarStatus !== 'Available' && currentCarStatus !== 'Rented') {
      throw new Error(`Vehicle is no longer available for activation (currently ${currentCarStatus})`);
    }

    if (existingRentalId) {
      await updateRowByIdInTransaction(
        client,
        'rentals',
        existingRentalId,
        rentalRepairPayload,
        'Failed to repair existing rental after checkout completion'
      );
    } else {
      await insertRowInTransaction(client, 'rentals', rentalInsertPayload);
    }

    await updateRowByIdInTransaction(
      client,
      'cars',
      carId,
      { status: 'Rented' },
      'Failed to mark car as rented'
    );

    await updateRowByIdInTransaction(
      client,
      'applications',
      applicationId,
      applicationPaymentPayload,
      'Failed to update application payment state'
    );

    await persistVehicleCheckoutFulfillmentMarkerInTransaction(
      client,
      fulfillmentSessionId,
      Number(existingFulfillmentLedgerRow?.id || 0) || null
    );

    return 'fulfilled' as const;
  });
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

export const handleVehicleCheckoutCompletion = async (
  session: Stripe.Checkout.Session
): Promise<'already_fulfilled' | 'fulfilled' | 'manual_review' | 'skipped'> => {
  const applicationId = normalizeUuid(session.metadata?.application_id || '');
  const carId = Number(session.metadata?.car_id || 0);
  const sessionPaymentLinkVersion = Number(session.metadata?.payment_link_version || 0);
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id || null;

  if (!applicationId || !carId || !subscriptionId) {
    return 'skipped' as const;
  }

  return withVehicleCheckoutProcessingLock(applicationId, async () => {
    if (await hasVehicleCheckoutFulfillmentMarker(session.id)) {
      console.info(
        `Ignoring replayed checkout completion ${session.id} because fulfillment is already recorded.`
      );
      return 'already_fulfilled' as const;
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
    const car = carResult.data as unknown as Record<string, unknown>;
    const { compat, rentalApplicationIdColumn, rentals: existingRentals } = existingRentalsResult;
    const approvedWeeklyPrice =
      Number(
        application.approved_weekly_price ??
          application.approvedWeeklyPrice ??
          session.metadata?.approved_weekly_price ??
          0
      ) || 0;
    const approvedBond =
      Number(
        application.approved_bond ??
          application.approvedBond ??
          session.metadata?.approved_bond ??
          0
      ) || 0;
    const safeApplicantName = escapeHtml(String(application.name || ''));
    const safeCarName = escapeHtml(String(car.name || ''));
    const recordedPaidAt = application.paid_at
      ? String(application.paid_at)
      : new Date().toISOString();

    const moveApplicationToPaymentReview = async (reason: string) => {
      const transitionedApplication = await updateApplicationPaymentState({
        applicationId,
        expectedPaymentLinkVersion: sessionPaymentLinkVersion,
        paidAt: recordedPaidAt,
        pendingCheckoutSessionId: session.id,
        status: 'Payment Review',
      });

      if (
        transitionedApplication === null &&
        applicationStatus !== 'Payment Review'
      ) {
        console.warn(
          `Skipped Payment Review transition for application ${applicationId} because its payment state advanced before ${session.id} finished processing.`
        );
        return 'manual_review' as const;
      }

      if (!process.env.RESEND_API_KEY) {
        return 'manual_review' as const;
      }

      try {
        const resend = await getResend();
        const adminEmail = process.env.ADMIN_EMAIL || FALLBACK_ADMIN_EMAIL;

        await sendResendEmail(resend, {
          from: 'Maple Rentals <noreply@maplerentals.com.au>',
          to: adminEmail,
          subject: `Activation review required for vehicle checkout ${session.id}`,
          html: `
            <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; color: #1a202c;">
              <h2 style="color: #D4AF37;">Payment Received, Activation Pending</h2>
              <p><strong>Application ID:</strong> ${applicationId}</p>
              <p><strong>Applicant:</strong> ${safeApplicantName}</p>
              <p><strong>Vehicle:</strong> ${safeCarName}</p>
              <p><strong>Checkout session:</strong> ${escapeHtml(session.id)}</p>
              <p><strong>Stripe subscription:</strong> ${escapeHtml(subscriptionId)}</p>
              <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send activation review alert email:', emailError);
      }

      return 'manual_review' as const;
    };

    if (!hasTransactionalPaymentProcessing()) {
      return moveApplicationToPaymentReview(
        AUTOMATIC_PAYMENT_ACTIVATION_RESTRICTED_REASON
      );
    }

    const applicationStatus = String(application.status || '');
    const assignedCarId = Number(application.assigned_car_id || 0);
    const pendingCheckoutSessionId = application.pending_checkout_session_id
      ? String(application.pending_checkout_session_id)
      : null;
    const sessionStillMatchesCurrentApproval =
      assignedCarId === carId &&
      sessionPaymentLinkVersion === Number(application.payment_link_version || 0);

    if (!sessionStillMatchesCurrentApproval) {
      return moveApplicationToPaymentReview(
        'Paid Stripe session no longer matches the latest approved vehicle assignment or payment link version.'
      );
    }

    if (
      applicationStatus !== 'Approved' &&
      applicationStatus !== 'Paid' &&
      applicationStatus !== 'Payment Review'
    ) {
      return moveApplicationToPaymentReview(
        `Paid Stripe session arrived while application ${applicationStatus || 'Unknown'} is not eligible for automatic activation.`
      );
    }

    // "Payment Review" means Stripe has already confirmed payment, but activation
    // hit a transient blocker. If the same signed checkout session replays later,
    // allow it to complete automatically instead of forcing a brand-new payment.
    if (
      applicationStatus === 'Payment Review' &&
      pendingCheckoutSessionId &&
      pendingCheckoutSessionId !== session.id
    ) {
      return moveApplicationToPaymentReview(
        `Stored payment review session ${pendingCheckoutSessionId} does not match checkout session ${session.id}.`
      );
    }

    const rentalsForApplication = existingRentals.filter(
      (rental) => String(rental[rentalApplicationIdColumn]) === applicationId
    );
    let existingRental =
      (compat.rentalStripeSubscriptionColumn
        ? existingRentals.find(
            (rental) => rental[compat.rentalStripeSubscriptionColumn!] === subscriptionId
          )
        : null) || null;

    if (!existingRental && rentalsForApplication.length === 1) {
      existingRental = rentalsForApplication[0];
    }

    if (!existingRental && rentalsForApplication.length > 1) {
      return moveApplicationToPaymentReview(
        `Multiple rentals match application ${applicationId} and car ${carId}; manual activation review required.`
      );
    }
    const blockingRental = existingRentals.find(
      (rental) =>
        isLiveRentalStatus(rental.status) &&
        String(rental[rentalApplicationIdColumn]) !== applicationId
    );

    const existingRentalSubscriptionId = compat.rentalStripeSubscriptionColumn
      ? String(existingRental?.[compat.rentalStripeSubscriptionColumn] || '')
      : '';

    if (applicationStatus === 'Paid' && existingRental) {
      if (
        existingRentalSubscriptionId &&
        existingRentalSubscriptionId !== subscriptionId
      ) {
        console.warn(
          `Ignoring duplicate checkout completion ${session.id} because application ${applicationId} is already bound to subscription ${existingRentalSubscriptionId}.`
        );
        return 'already_fulfilled' as const;
      }

      console.info(
        `Ignoring replayed checkout completion ${session.id} because application ${applicationId} is already active.`
      );
      return 'already_fulfilled' as const;
    }

    if (blockingRental) {
      return moveApplicationToPaymentReview(
        `Vehicle ${carId} is already attached to another live rental.`
      );
    }

    if (!existingRental) {
      if (String(car.status) !== 'Available' && String(car.status) !== 'Rented') {
        return moveApplicationToPaymentReview(
          `Vehicle ${carId} is not available for activation while marked ${car.status}.`
        );
      }

      const rentalInsertPayload = (await toRentalWritePayload({
        application_id: applicationId,
        bond_paid: approvedBond,
        car_id: carId,
        start_date: activeDate,
        status: 'Active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        weekly_price: approvedWeeklyPrice,
      })) as Record<string, unknown>;
      const rentalRepairPayload = stripRentalIdentityFields(rentalInsertPayload);

      try {
        const activationOutcome = await applyVehicleCheckoutActivationWrites({
          applicationId,
          carId,
          existingRentalId: null,
          expectedPaymentLinkVersion: sessionPaymentLinkVersion,
          fulfillmentSessionId: session.id,
          paidAt: recordedPaidAt,
          rentalInsertPayload,
          rentalRepairPayload,
        });

        if (activationOutcome === 'already_fulfilled') {
          return activationOutcome;
        }
      } catch (error) {
        if (!isDuplicateWrite(error)) {
          throw error;
        }

        const refetchedRentals = await fetchExistingRentalsForCar(carId);
        const refetchedRentalsForApplication = refetchedRentals.rentals.filter(
          (rental) => String(rental[rentalApplicationIdColumn]) === applicationId
        );

        existingRental =
          (compat.rentalStripeSubscriptionColumn
            ? refetchedRentals.rentals.find(
                (rental) => rental[compat.rentalStripeSubscriptionColumn!] === subscriptionId
              )
            : null) ||
          (refetchedRentalsForApplication.length === 1
            ? refetchedRentalsForApplication[0]
            : null);

        if (!existingRental && refetchedRentalsForApplication.length > 1) {
          return moveApplicationToPaymentReview(
            `Multiple rentals match application ${applicationId} and car ${carId}; manual activation review required.`
          );
        }

        if (!existingRental) {
          throw new Error(
            `Rental insert reported a duplicate write, but no rental could be recovered for application ${applicationId}.`
          );
        }
      }
    }

    if (existingRental) {
      const rentalInsertPayload = (await toRentalWritePayload({
        application_id: applicationId,
        bond_paid: approvedBond,
        car_id: carId,
        start_date: activeDate,
        status: 'Active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        weekly_price: approvedWeeklyPrice,
      })) as Record<string, unknown>;
      const rentalRepairPayload = stripRentalIdentityFields(rentalInsertPayload);

      const activationOutcome = await applyVehicleCheckoutActivationWrites({
        applicationId,
        carId,
        existingRentalId: Number(existingRental.id),
        expectedPaymentLinkVersion: sessionPaymentLinkVersion,
        fulfillmentSessionId: session.id,
        paidAt: recordedPaidAt,
        rentalInsertPayload,
        rentalRepairPayload,
      });

      if (activationOutcome === 'already_fulfilled') {
        return activationOutcome;
      }
    }

    if (!process.env.RESEND_API_KEY || String(application.status) === 'Paid') {
      return 'fulfilled' as const;
    }

    try {
      const resend = await getResend();
      await sendResendEmail(resend, {
        from: 'Maple Rentals <noreply@maplerentals.com.au>',
        to: String(application.email),
        subject: 'Rental Confirmed - Maple Rentals',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
            <h2 style="color: #D4AF37;">Payment Confirmed</h2>
            <p>Hi ${safeApplicantName},</p>
            <p>Your payment for the <strong>${safeCarName}</strong> has been successfully processed.</p>
            <p>Your rental is now <strong>Active</strong>. We will contact you shortly with collection details.</p>
            <p><strong>Subscription ID:</strong> ${escapeHtml(subscriptionId)}</p>
            <br>
            <p>Best regards,</p>
            <p><strong>The Maple Rentals Team</strong></p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Failed to send rental confirmation email:', emailErr);
    }

    return 'fulfilled' as const;
  });
};
