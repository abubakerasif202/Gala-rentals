import express from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateAdmin } from './auth.js';
import { createCheckoutToken, verifyCheckoutToken } from '../checkoutTokens.js';
import { LEASE_SETTINGS, RENTAL_PLAN_SETUP_FEES_AUD, STRIPE_CONFIG } from '../constants.js';
import {
  vehicleCheckoutLinkSchema,
  vehicleCheckoutSessionSchema,
} from '../validation.js';
import {
  buildRentalPlanWithPricing,
  rentalPlans,
} from '../../src/lib/rentalPlans.js';
import {
  getApplicationSelectColumns,
  getCarSelectColumns,
  getRentalApplicationIdColumn,
  getRentalCarIdColumn,
  toApplicationPaymentWritePayload,
} from '../schemaCompat.js';
import { buildDriverPaymentLink, getAppBaseUrl } from '../paymentLinks.js';
import {
  assertVehicleAllocationAvailable,
  VehicleAllocationConflictError,
} from '../vehicleAllocations.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', STRIPE_CONFIG);

type BillingBreakdown = {
  bond: number;
  currency: string;
  initialRental: number;
  recurringAmount: number;
  recurringInterval: 'week' | 'month';
  recurringIntervalCount: number;
  recurringLabel: string;
  setupFees: number;
  upfrontDue: number;
};

type StripeApplication = {
  approved_bond?: number | string | null;
  approved_weekly_price?: number | string | null;
  assigned_car_id?: number | null;
  email: string;
  id: number;
  name: string;
  payment_link_version?: number | null;
  pending_checkout_session_id?: string | null;
  status: string;
};

type StripeCar = {
  bond: number | string;
  id: number;
  image: string;
  model_year: number;
  name: string;
  status: string;
  weekly_price: number | string;
};

const isStripeConfigurationError = (
  error: unknown
): error is { code?: string; message?: string; type?: string } =>
  Boolean(
    error &&
      typeof error === 'object' &&
      (('type' in error && (error as { type?: string }).type === 'StripeAuthenticationError') ||
        ('code' in error &&
          ['api_key_expired', 'api_key_invalid'].includes(
            String((error as { code?: string }).code || '')
          )))
  );

const toFloat = (value: number | string | null | undefined) =>
  Number(Number(value || 0).toFixed(2));
const toCents = (value: number) => Math.round(value * 100);
const toOptionalPositiveInt = (value: string | undefined) => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildApprovedBillingBreakdown = (application: StripeApplication): BillingBreakdown => {
  const approvedBond = toFloat(application.approved_bond);
  const approvedWeeklyPrice = toFloat(application.approved_weekly_price);

  return {
    bond: approvedBond,
    currency: LEASE_SETTINGS.currency.toUpperCase(),
    initialRental: approvedWeeklyPrice,
    recurringAmount: approvedWeeklyPrice,
    recurringInterval: LEASE_SETTINGS.recurring_interval,
    recurringIntervalCount: 1,
    recurringLabel: 'per week',
    setupFees: RENTAL_PLAN_SETUP_FEES_AUD,
    upfrontDue: toFloat(approvedBond + approvedWeeklyPrice + RENTAL_PLAN_SETUP_FEES_AUD),
  };
};

const buildCancelUrl = ({
  applicationId,
  carId,
  token,
}: {
  applicationId: number;
  carId: number;
  token: string;
}) => {
  const checkoutUrl = new URL(`/checkout/${carId}`, getAppBaseUrl());
  checkoutUrl.searchParams.set('application_id', String(applicationId));
  checkoutUrl.searchParams.set('token', token);
  checkoutUrl.searchParams.set('resume_payment', '1');
  return checkoutUrl.toString();
};

const buildSuccessUrl = ({
  applicationId,
  carId,
  token,
}: {
  applicationId: number;
  carId: number;
  token: string;
}) => {
  const url = new URL('/success', getAppBaseUrl());
  url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  url.searchParams.set('application_id', String(applicationId));
  url.searchParams.set('checkout_token', token);
  url.searchParams.set('car_id', String(carId));
  return url.toString();
};

const buildSubscriptionLineItems = ({
  billingBreakdown,
  carName,
}: {
  billingBreakdown: BillingBreakdown;
  carName: string;
}) => {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: LEASE_SETTINGS.currency,
        product_data: {
          name: 'Security Bond',
          description: 'Refundable bond collected before activation.',
        },
        unit_amount: toCents(billingBreakdown.bond),
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: LEASE_SETTINGS.currency,
        product_data: {
          name: `First week for ${carName}`,
          description: 'First weekly payment charged during signup.',
        },
        unit_amount: toCents(billingBreakdown.initialRental),
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: LEASE_SETTINGS.currency,
        product_data: {
          name: 'Onboarding setup fees',
          description: 'Account and direct debit setup.',
        },
        unit_amount: toCents(billingBreakdown.setupFees),
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: LEASE_SETTINGS.currency,
        product_data: {
          name: `${carName} weekly rental`,
          description: 'Recurring weekly rental subscription.',
        },
        recurring: {
          interval: billingBreakdown.recurringInterval,
          interval_count: billingBreakdown.recurringIntervalCount,
        },
        unit_amount: toCents(billingBreakdown.recurringAmount),
      },
      quantity: 1,
    },
  ];

  return lineItems.filter((item) => {
    const unitAmount = item.price_data?.unit_amount ?? 0;
    return unitAmount > 0;
  });
};

const createHostedCheckoutSession = async ({
  application,
  billingBreakdown,
  car,
  checkoutToken,
}: {
  application: StripeApplication;
  billingBreakdown: BillingBreakdown;
  car: StripeCar;
  checkoutToken: string;
}) => {
  const metadata = {
    application_id: String(application.id),
    car_id: String(car.id),
    checkout_kind: 'vehicle',
    approved_bond: billingBreakdown.bond.toFixed(2),
    approved_weekly_price: billingBreakdown.recurringAmount.toFixed(2),
    payment_link_version: String(Number(application.payment_link_version || 0)),
  };

  return stripe.checkout.sessions.create(
    {
      billing_address_collection: 'auto',
      cancel_url: buildCancelUrl({
        applicationId: application.id,
        carId: car.id,
        token: checkoutToken,
      }),
      client_reference_id: String(application.id),
      customer_email: application.email,
      line_items: buildSubscriptionLineItems({
        billingBreakdown,
        carName: car.name,
      }),
      metadata,
      mode: 'subscription',
      payment_method_types: ['card'],
      subscription_data: {
        metadata,
      },
      success_url: buildSuccessUrl({
        applicationId: application.id,
        carId: car.id,
        token: checkoutToken,
      }),
    },
    {
      idempotencyKey: `vehicle-checkout:${application.id}:v${Number(application.payment_link_version || 0)}`,
    }
  );
};

const fetchApplication = async (applicationId: number) => {
  const selectColumns = await getApplicationSelectColumns();
  const { data: application, error } = await db
    .from('applications')
    .select(selectColumns)
    .eq('id', applicationId)
    .single();

  if (error || !application) {
    return null;
  }

  return application as unknown as StripeApplication;
};

const fetchCar = async (carId: number) => {
  const carSelectColumns = await getCarSelectColumns();
  const { data: car, error } = await db
    .from('cars')
    .select(carSelectColumns)
    .eq('id', carId)
    .single();

  if (error || !car) {
    return null;
  }

  return car as StripeCar;
};

const requireApprovedPaymentContext = ({
  application,
  carId,
}: {
  application: StripeApplication;
  carId: number;
}) => {
  if (application.status === 'Paid') {
    throw new Error('Payment link has already been used.');
  }

  if (application.status === 'Payment Review') {
    throw new Error('This payment is currently under manual review.');
  }

  if (application.status !== 'Approved') {
    throw new Error('Payment link is not ready for payment yet.');
  }

  if (!application.assigned_car_id || Number(application.assigned_car_id) !== carId) {
    throw new Error('Payment link does not match the approved vehicle.');
  }

  if (toFloat(application.approved_bond) < 0 || toFloat(application.approved_weekly_price) <= 0) {
    throw new Error('Payment link is missing approved pricing.');
  }
};

const expirePendingCheckoutSession = async (sessionId: string | null | undefined) => {
  if (!sessionId) {
    return;
  }

  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (error) {
    console.warn(`Unable to expire checkout session ${sessionId}:`, error);
  }
};

const persistPendingCheckoutSessionId = async (
  applicationId: number,
  sessionId: string | null
) => {
  const payload = await toApplicationPaymentWritePayload({
    pending_checkout_session_id: sessionId,
  });
  const { error } = await db.from('applications').update(payload).eq('id', applicationId);

  if (error) {
    throw error;
  }
};

const resolvePendingCheckoutSession = async ({
  application,
  carId,
}: {
  application: StripeApplication;
  carId: number;
}) => {
  const pendingSessionId = application.pending_checkout_session_id;
  if (!pendingSessionId) {
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(pendingSessionId);
    const sessionVersion = Number(session.metadata?.payment_link_version || 0);
    const sessionCarId = Number(session.metadata?.car_id || 0);
    const sessionApplicationId = Number(session.metadata?.application_id || 0);

    if (
      session.status === 'open' &&
      sessionApplicationId === application.id &&
      sessionCarId === carId &&
      sessionVersion === Number(application.payment_link_version || 0) &&
      session.url
    ) {
      return session;
    }

    if (session.status !== 'open') {
      await persistPendingCheckoutSessionId(application.id, null);
    }
  } catch (error) {
    console.warn(`Unable to reuse checkout session ${pendingSessionId}:`, error);
    await persistPendingCheckoutSessionId(application.id, null);
  }

  return null;
};

router.get('/rental-plans', (_req, res) => {
  res.json(rentalPlans.map((plan) => buildRentalPlanWithPricing(plan, LEASE_SETTINGS.fees)));
});

router.get('/lease-settings', (_req, res) => {
  res.json({
    currency: LEASE_SETTINGS.currency.toUpperCase(),
    recurring_interval: LEASE_SETTINGS.recurring_interval,
    minimum_rental_weeks: LEASE_SETTINGS.minimum_rental_weeks,
    insurance_coverage_region: LEASE_SETTINGS.insurance_coverage_region,
    fees: LEASE_SETTINGS.fees,
  });
});

router.get('/payment-context', async (req, res) => {
  try {
    const { application_id, car_id, checkout_token } = z
      .object({
        application_id: z.coerce.number().int().positive(),
        car_id: z.coerce.number().int().positive(),
        checkout_token: z.string().min(1),
      })
      .parse(req.query);

    const [application, car] = await Promise.all([
      fetchApplication(application_id),
      fetchCar(car_id),
    ]);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    verifyCheckoutToken({
      applicationId: application_id,
      carId: car_id,
      purpose: 'vehicle',
      token: checkout_token,
      version: Number(application.payment_link_version || 0),
    });
    requireApprovedPaymentContext({ application, carId: car_id });
    await assertVehicleAllocationAvailable({
      applicationId: application_id,
      carId: car_id,
      message:
        'This payment link is no longer active because the vehicle has been allocated elsewhere. Contact Maple Rentals for a fresh link.',
    });

    const billing = buildApprovedBillingBreakdown(application);

    res.json({
      applicant_name: application.name,
      application_id,
      billing,
      car,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (error instanceof VehicleAllocationConflictError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes('payment link') ||
        error.message.toLowerCase().includes('manual review'))
    ) {
      return res.status(409).json({ error: error.message });
    }

    if (error instanceof Error && error.message.toLowerCase().includes('checkout token')) {
      return res.status(401).json({ error: error.message });
    }

    console.error('Payment context error:', error);
    res.status(500).json({ error: 'Failed to load the payment link details' });
  }
});

router.post('/vehicle-checkout-session', async (req, res) => {
  try {
    const { application_id, car_id, checkout_token } = vehicleCheckoutSessionSchema.parse(req.body);

    const [application, car] = await Promise.all([
      fetchApplication(application_id),
      fetchCar(car_id),
    ]);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    verifyCheckoutToken({
      applicationId: application_id,
      carId: car_id,
      purpose: 'vehicle',
      token: checkout_token,
      version: Number(application.payment_link_version || 0),
    });
    requireApprovedPaymentContext({ application, carId: car_id });
    await assertVehicleAllocationAvailable({
      applicationId: application_id,
      carId: car_id,
      message:
        'This payment link is no longer active because the vehicle has been allocated elsewhere. Contact Maple Rentals for a fresh link.',
    });

    if (car.status !== 'Available') {
      return res.status(409).json({ error: 'Selected vehicle is no longer available.' });
    }

    const existingSession = await resolvePendingCheckoutSession({
      application,
      carId: car.id,
    });

    if (existingSession?.url) {
      return res.json({
        checkout_url: existingSession.url,
        session_id: existingSession.id,
      });
    }

    const session = await createHostedCheckoutSession({
      application,
      billingBreakdown: buildApprovedBillingBreakdown(application),
      car,
      checkoutToken: checkout_token,
    });
    await persistPendingCheckoutSessionId(application_id, session.id);

    res.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (error instanceof VehicleAllocationConflictError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (isStripeConfigurationError(error)) {
      console.error('Stripe configuration error during vehicle checkout session:', error);
      return res.status(503).json({
        error: 'Payments are temporarily unavailable. Please contact support.',
      });
    }

    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes('payment link') ||
        error.message.toLowerCase().includes('manual review'))
    ) {
      return res.status(409).json({ error: error.message });
    }

    if (error instanceof Error && error.message.toLowerCase().includes('checkout token')) {
      return res.status(401).json({ error: error.message });
    }

    console.error('Vehicle checkout session error:', error);
    res.status(500).json({ error: 'Failed to create the vehicle checkout session' });
  }
});

router.post('/vehicle-checkout-link', authenticateAdmin, async (req, res) => {
  try {
    const { application_id } = vehicleCheckoutLinkSchema.parse(req.body);
    const application = await fetchApplication(application_id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status === 'Paid') {
      return res.status(409).json({ error: 'This application has already been paid.' });
    }

    if (application.status !== 'Approved') {
      return res.status(409).json({
        error: 'Approve the application and save pricing before sending a payment link.',
      });
    }

    if (!application.assigned_car_id) {
      return res.status(409).json({ error: 'Assign a vehicle before sending a payment link.' });
    }

    const car = await fetchCar(Number(application.assigned_car_id));

    if (!car) {
      return res.status(404).json({ error: 'Assigned vehicle not found' });
    }

    if (car.status !== 'Available') {
      return res.status(409).json({ error: 'Assigned vehicle is not available.' });
    }

    await assertVehicleAllocationAvailable({
      applicationId: application_id,
      carId: car.id,
      message:
        'This vehicle already has another active approval or payment review. Resolve that allocation first.',
    });

    const nextVersion = Number(application.payment_link_version || 0) + 1;
    await expirePendingCheckoutSession(application.pending_checkout_session_id);
    const updatePayload = await toApplicationPaymentWritePayload({
      payment_link_sent_at: new Date().toISOString(),
      payment_link_version: nextVersion,
      pending_checkout_session_id: null,
    });
    const { error: updateError } = await db
      .from('applications')
      .update(updatePayload)
      .eq('id', application_id);

    if (updateError) {
      throw updateError;
    }

    const checkoutToken = createCheckoutToken({
      applicationId: application_id,
      carId: car.id,
      purpose: 'vehicle',
      version: nextVersion,
    });

    res.json({
      checkout_token: checkoutToken.token,
      checkout_token_expires_at: checkoutToken.expiresAt,
      checkout_url: buildDriverPaymentLink({
        applicationId: application_id,
        carId: car.id,
        token: checkoutToken.token,
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (error instanceof VehicleAllocationConflictError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Vehicle checkout link error:', error);
    res.status(500).json({ error: 'Failed to generate the vehicle checkout link' });
  }
});

router.get('/checkout-sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    const { application_id, car_id, checkout_token } = z
      .object({
        application_id: z.coerce.number().int().positive(),
        car_id: z.coerce.number().int().positive(),
        checkout_token: z.string().min(1),
      })
      .parse(req.query);

    const application = await fetchApplication(application_id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    verifyCheckoutToken({
      applicationId: application_id,
      carId: car_id,
      purpose: 'vehicle',
      token: checkout_token,
      version: Number(application.payment_link_version || 0),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadataApplicationId = Number(session.metadata?.application_id || 0);
    const metadataCarId = toOptionalPositiveInt(session.metadata?.car_id);
    const metadataCheckoutKind = session.metadata?.checkout_kind || null;
    const metadataVersion = Number(session.metadata?.payment_link_version || 0);

    if (metadataApplicationId !== application_id) {
      return res.status(403).json({ error: 'Checkout session does not match this application.' });
    }

    if (metadataCheckoutKind !== 'vehicle') {
      return res.status(403).json({ error: 'Checkout session does not match this payment link.' });
    }

    if (metadataCarId !== car_id) {
      return res.status(403).json({ error: 'Checkout session does not match this vehicle link.' });
    }

    if (metadataVersion !== Number(application.payment_link_version || 0)) {
      return res.status(403).json({ error: 'Checkout session belongs to an outdated payment link.' });
    }

    const rentalCarIdColumn = await getRentalCarIdColumn();
    const rentalApplicationIdColumn = await getRentalApplicationIdColumn();
    const { data: rental } = await db
      .from('rentals')
      .select('id, status')
      .eq(rentalCarIdColumn, car_id)
      .eq(rentalApplicationIdColumn, application_id)
      .single();

    const internalStatus =
      application.status === 'Paid' && rental?.status === 'Active'
        ? 'complete'
        : application.status === 'Payment Review' &&
            session.status === 'complete' &&
            session.payment_status === 'paid'
          ? 'manual_review'
        : session.status === 'complete' && session.payment_status === 'paid'
          ? 'pending'
          : 'open';

    res.json({
      application_status: application.status,
      checkout_kind: metadataCheckoutKind,
      id: session.id,
      internal_status: internalStatus,
      payment_status: session.payment_status,
      rental_status: rental?.status || null,
      status: session.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (error instanceof Error && error.message.toLowerCase().includes('checkout token')) {
      return res.status(401).json({ error: error.message });
    }

    console.error('Checkout session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch checkout session status' });
  }
});

export default router;
