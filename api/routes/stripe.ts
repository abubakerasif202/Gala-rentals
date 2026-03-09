import express from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateAdmin } from './auth.js';
import { createCheckoutToken, verifyCheckoutToken } from '../checkoutTokens.js';
import { LEASE_SETTINGS, RENTAL_PLAN_SETUP_FEES_AUD, STRIPE_CONFIG } from '../constants.js';
import {
  applicationCheckoutSessionSchema,
  vehicleCheckoutLinkSchema,
  vehicleCheckoutSessionSchema,
} from '../validation.js';
import {
  buildRentalPlanWithPricing,
  getRentalPlanById,
  rentalPlans,
  type RentalPlanWithPricing,
} from '../../src/lib/rentalPlans.js';
import { getCarSelectColumns } from '../schemaCompat.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', STRIPE_CONFIG);
const APP_URL = (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(
  /\/+$/,
  ''
);

type BillingBreakdown = {
  bond: number;
  currency: string;
  initialRental: number;
  minimumRentalWeeks: number;
  planId: string | null;
  planName: string | null;
  recurringAmount: number;
  recurringInterval: 'week' | 'month';
  recurringIntervalCount: number;
  recurringLabel: string;
  recurringWeekly: number;
  serviceFee: number;
  setupFees: number;
  upfrontDue: number;
};

type StripeApplication = {
  email: string;
  id: number;
  name: string;
  status: string;
};

type StripeCar = {
  bond: number | string;
  id: number;
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

const toFloat = (value: number | string) => Number(Number(value).toFixed(2));
const toCents = (value: number) => Math.round(value * 100);

const buildApplicationBillingBreakdown = (plan: RentalPlanWithPricing): BillingBreakdown => ({
  bond: plan.pricing.bondAud,
  currency: LEASE_SETTINGS.currency.toUpperCase(),
  initialRental: plan.pricing.initialRentalAud,
  minimumRentalWeeks: LEASE_SETTINGS.minimum_rental_weeks,
  planId: plan.id,
  planName: plan.name,
  recurringAmount: plan.pricing.recurringDueAud,
  recurringInterval: plan.pricing.recurringInterval,
  recurringIntervalCount: plan.pricing.recurringIntervalCount,
  recurringLabel: plan.pricing.recurringLabel,
  recurringWeekly: plan.pricing.recurringDueAud,
  serviceFee: plan.pricing.serviceFeeAud,
  setupFees: RENTAL_PLAN_SETUP_FEES_AUD,
  upfrontDue: plan.pricing.upfrontDueAud,
});

const buildVehicleBillingBreakdown = (car: StripeCar): BillingBreakdown => {
  const initialRental = toFloat(car.weekly_price);
  const bond = toFloat(car.bond);
  const serviceFee = LEASE_SETTINGS.fees.account_management_weekly;
  const recurringAmount = toFloat(initialRental + serviceFee);

  return {
    bond,
    currency: LEASE_SETTINGS.currency.toUpperCase(),
    initialRental,
    minimumRentalWeeks: LEASE_SETTINGS.minimum_rental_weeks,
    planId: null,
    planName: car.name,
    recurringAmount,
    recurringInterval: LEASE_SETTINGS.recurring_interval,
    recurringIntervalCount: 1,
    recurringLabel: 'per week',
    recurringWeekly: recurringAmount,
    serviceFee: toFloat(serviceFee),
    setupFees: RENTAL_PLAN_SETUP_FEES_AUD,
    upfrontDue: toFloat(bond + initialRental + RENTAL_PLAN_SETUP_FEES_AUD),
  };
};

const buildCancelUrl = ({
  applicationId,
  carId,
  planId,
  token,
}: {
  applicationId: number;
  carId?: number | null;
  planId?: string | null;
  token: string;
}) => {
  const pathname = carId ? `/checkout/${carId}` : '/apply';
  const url = new URL(pathname, APP_URL);

  url.searchParams.set('application_id', String(applicationId));
  url.searchParams.set('checkout_token', token);
  url.searchParams.set('resume_checkout', '1');

  if (carId) {
    url.searchParams.set('token', token);
  }

  if (planId) {
    url.searchParams.set('planId', planId);
  }

  return url.toString();
};

const buildSuccessUrl = ({
  applicationId,
  carId,
  token,
}: {
  applicationId: number;
  carId?: number | null;
  token: string;
}) => {
  const url = new URL('/success', APP_URL);
  url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  url.searchParams.set('application_id', String(applicationId));
  url.searchParams.set('checkout_token', token);

  if (carId) {
    url.searchParams.set('car_id', String(carId));
  }

  return url.toString();
};

const buildSubscriptionLineItems = ({
  billingBreakdown,
  initialLineItemName,
  recurringLineItemName,
}: {
  billingBreakdown: BillingBreakdown;
  initialLineItemName: string;
  recurringLineItemName: string;
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
          name: initialLineItemName,
          description: 'First cycle charged during signup.',
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
          name: recurringLineItemName,
          description: `Recurring rental charge including ${billingBreakdown.serviceFee.toFixed(2)} service fee.`,
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
  cancelUrl,
  carId = null,
  checkoutKind,
  recurringLineItemName,
  initialLineItemName,
  successUrl,
}: {
  application: StripeApplication;
  billingBreakdown: BillingBreakdown;
  cancelUrl: string;
  carId?: number | null;
  checkoutKind: 'application' | 'vehicle';
  initialLineItemName: string;
  recurringLineItemName: string;
  successUrl: string;
}) => {
  const metadata = {
    application_id: String(application.id),
    car_id: carId ? String(carId) : '',
    checkout_kind: checkoutKind,
    pricing_plan_id: billingBreakdown.planId ?? '',
    pricing_plan_name: billingBreakdown.planName ?? '',
    lease_minimum_weeks: String(billingBreakdown.minimumRentalWeeks),
    insurance_coverage_region: LEASE_SETTINGS.insurance_coverage_region,
  };

  return stripe.checkout.sessions.create({
    billing_address_collection: 'auto',
    cancel_url: cancelUrl,
    client_reference_id: String(application.id),
    customer_email: application.email,
    line_items: buildSubscriptionLineItems({
      billingBreakdown,
      initialLineItemName,
      recurringLineItemName,
    }),
    metadata,
    mode: 'subscription',
    payment_method_types: ['card'],
    subscription_data: {
      metadata,
    },
    success_url: successUrl,
  });
};

const fetchApplication = async (applicationId: number) => {
  const { data: application, error } = await db
    .from('applications')
    .select('id, name, email, status')
    .eq('id', applicationId)
    .single();

  if (error || !application) {
    return null;
  }

  return application as StripeApplication;
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

router.post('/application-checkout-session', async (req, res) => {
  try {
    const { application_id, checkout_token, plan_id } = applicationCheckoutSessionSchema.parse(
      req.body
    );

    const application = await fetchApplication(application_id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    verifyCheckoutToken({
      applicationId: application_id,
      purpose: 'application',
      token: checkout_token,
    });

    if (application.status !== 'Pending') {
      return res.status(409).json({
        error: 'This application is already in progress or has already been paid.',
      });
    }

    const selectedPlanBase = getRentalPlanById(plan_id);
    if (!selectedPlanBase) {
      return res.status(404).json({ error: 'Rental plan not found' });
    }

    const selectedPlan = buildRentalPlanWithPricing(selectedPlanBase, LEASE_SETTINGS.fees);
    const session = await createHostedCheckoutSession({
      application,
      billingBreakdown: buildApplicationBillingBreakdown(selectedPlan),
      cancelUrl: buildCancelUrl({
        applicationId: application_id,
        planId: selectedPlan.id,
        token: checkout_token,
      }),
      checkoutKind: 'application',
      initialLineItemName: `${selectedPlan.name} upfront rental`,
      recurringLineItemName: `${selectedPlan.name} recurring rental`,
      successUrl: buildSuccessUrl({
        applicationId: application_id,
        token: checkout_token,
      }),
    });

    res.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (isStripeConfigurationError(error)) {
      console.error('Stripe configuration error during application checkout session:', error);
      return res.status(503).json({
        error: 'Payments are temporarily unavailable. Please contact support.',
      });
    }

    if (error instanceof Error && error.message.toLowerCase().includes('checkout token')) {
      return res.status(401).json({ error: error.message });
    }

    console.error('Application checkout session error:', error);
    res.status(500).json({ error: 'Failed to create the checkout session' });
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
    });

    if (!['Approved', 'Paid'].includes(application.status)) {
      return res.status(409).json({
        error: 'Application must be approved before starting vehicle checkout.',
      });
    }

    if (car.status !== 'Available') {
      return res.status(409).json({ error: 'Selected vehicle is no longer available.' });
    }

    const session = await createHostedCheckoutSession({
      application,
      billingBreakdown: buildVehicleBillingBreakdown(car),
      cancelUrl: buildCancelUrl({
        applicationId: application_id,
        carId: car_id,
        token: checkout_token,
      }),
      carId: car.id,
      checkoutKind: 'vehicle',
      initialLineItemName: `First week for ${car.name}`,
      recurringLineItemName: `${car.name} recurring rental`,
      successUrl: buildSuccessUrl({
        applicationId: application_id,
        carId: car_id,
        token: checkout_token,
      }),
    });

    res.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    if (isStripeConfigurationError(error)) {
      console.error('Stripe configuration error during vehicle checkout session:', error);
      return res.status(503).json({
        error: 'Payments are temporarily unavailable. Please contact support.',
      });
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
    const { application_id, car_id } = vehicleCheckoutLinkSchema.parse(req.body);
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

    if (!['Approved', 'Paid'].includes(application.status)) {
      return res.status(409).json({
        error: 'Application must be approved before generating a vehicle checkout link.',
      });
    }

    if (car.status !== 'Available') {
      return res.status(409).json({ error: 'Selected vehicle is no longer available.' });
    }

    const checkoutToken = createCheckoutToken({
      applicationId: application_id,
      carId: car_id,
      purpose: 'vehicle',
    });

    const checkoutUrl = new URL(`/checkout/${car_id}`, APP_URL);
    checkoutUrl.searchParams.set('application_id', String(application_id));
    checkoutUrl.searchParams.set('token', checkoutToken.token);

    res.json({
      checkout_token: checkoutToken.token,
      checkout_token_expires_at: checkoutToken.expiresAt,
      checkout_url: checkoutUrl.toString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
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
        car_id: z.coerce.number().int().positive().optional(),
        checkout_token: z.string().min(1),
      })
      .parse(req.query);

    verifyCheckoutToken({
      applicationId: application_id,
      carId: car_id ?? null,
      purpose: car_id ? 'vehicle' : 'application',
      token: checkout_token,
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadataApplicationId = Number(session.metadata?.application_id || 0);

    if (metadataApplicationId !== application_id) {
      return res.status(403).json({ error: 'Checkout session does not match this application.' });
    }

    res.json({
      checkout_kind: session.metadata?.checkout_kind || null,
      id: session.id,
      payment_status: session.payment_status,
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
