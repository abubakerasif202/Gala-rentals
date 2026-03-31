import express from 'express';
import type Stripe from 'stripe';
import { z } from 'zod';

import {
  persistPendingCheckoutSessionIdIfCurrentVersion,
  updateApplicationPaymentStateIfCurrentVersion,
} from '../applicationPaymentState.js';
import { ensureStripeCatalog } from '../stripeCatalog.js';
import { getStripeClient } from '../stripeClient.js';
import { db } from '../db/index.js';
import {
  withPostgresAdvisoryLock,
} from '../db/postgres.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createCheckoutToken, verifyCheckoutToken } from '../checkoutTokens.js';
import { LEASE_SETTINGS, RENTAL_PLAN_SETUP_FEES_AUD } from '../constants.js';
import {
  uuidSchema,
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
} from '../schemaCompat.js';
import {
  appendCheckoutTokenHash,
  buildDriverPaymentLink,
  getAppBaseUrl,
} from '../paymentLinks.js';
import {
  assertVehicleAllocationAvailable,
  VehicleAllocationConflictError,
} from '../vehicleAllocations.js';
import { renderApplicationLeaseAgreement } from '../agreementGeneration.js';
import {
  ADMIN_PAYMENTS_RESTRICTED_MESSAGE,
  assertTransactionalPaymentProcessing,
} from '../paymentProcessing.js';
import { normalizeUuid } from '../../shared/uuid.js';

const router = express.Router();
const getStripe = () => getStripeClient();

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

type HostedCheckoutSessionResponse = {
  checkout_url: string | null;
  session_id: string;
};

type PendingCheckoutSessionResolution = {
  retryKeySeed: string | null;
  session: Stripe.Checkout.Session | null;
};

type StripeApplication = {
  approved_at?: string | null;
  approved_bond?: number | string | null;
  approved_weekly_price?: number | string | null;
  assigned_car_id?: number | null;
  email: string;
  id: string;
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
const fromCents = (value: number) => Number((value / 100).toFixed(2));
const toOptionalPositiveInt = (value: string | undefined) => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getCheckoutTokenFromRequest = (
  req: express.Request,
  fallbackToken?: string | null
) => {
  const headerToken = req.header('x-checkout-token');
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  if (typeof fallbackToken === 'string' && fallbackToken.trim()) {
    return fallbackToken.trim();
  }

  const queryToken = req.query.checkout_token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  return null;
};

const buildHostedCheckoutSessionIdempotencyKey = ({
  applicationId,
  paymentLinkVersion,
  retryKeySeed,
}: {
  applicationId: string;
  paymentLinkVersion: number;
  retryKeySeed?: string | null;
}) => {
  const baseKey = `vehicle-checkout:${applicationId}:v${paymentLinkVersion}`;
  return retryKeySeed ? `${baseKey}:retry:${retryKeySeed}` : baseKey;
};

const buildApprovedBillingBreakdown = (application: StripeApplication): BillingBreakdown => {
  const approvedBondCents = Math.round(Number(application.approved_bond || 0) * 100);
  const approvedWeeklyPriceCents = Math.round(
    Number(application.approved_weekly_price || 0) * 100
  );
  const setupFeesCents = Math.round(RENTAL_PLAN_SETUP_FEES_AUD * 100);
  const upfrontDueCents =
    approvedBondCents + approvedWeeklyPriceCents + setupFeesCents;

  return {
    bond: fromCents(approvedBondCents),
    currency: LEASE_SETTINGS.currency.toUpperCase(),
    initialRental: fromCents(approvedWeeklyPriceCents),
    recurringAmount: fromCents(approvedWeeklyPriceCents),
    recurringInterval: LEASE_SETTINGS.recurring_interval,
    recurringIntervalCount: 1,
    recurringLabel: 'per week',
    setupFees: fromCents(setupFeesCents),
    upfrontDue: fromCents(upfrontDueCents),
  };
};

const buildCancelUrl = ({
  applicationId,
  carId,
  token,
}: {
  applicationId: string;
  carId: number;
  token: string;
}) => {
  const checkoutUrl = new URL(`/checkout/${carId}`, getAppBaseUrl());
  checkoutUrl.searchParams.set('application_id', String(applicationId));
  checkoutUrl.searchParams.set('resume_payment', '1');
  return appendCheckoutTokenHash(checkoutUrl, token).toString();
};

const buildSuccessUrl = ({
  applicationId,
  carId,
  token,
}: {
  applicationId: string;
  carId: number;
  token: string;
}) => {
  const url = new URL('/success', getAppBaseUrl());
  url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  url.searchParams.set('application_id', String(applicationId));
  url.searchParams.set('car_id', String(carId));
  return appendCheckoutTokenHash(url, token).toString();
};

const buildSubscriptionLineItems = async ({
  billingBreakdown,
}: {
  billingBreakdown: BillingBreakdown;
}) => {
  const stripeCatalog = await ensureStripeCatalog(getStripe());
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: LEASE_SETTINGS.currency,
        product: stripeCatalog.securityBond.productId,
        unit_amount: toCents(billingBreakdown.bond),
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: LEASE_SETTINGS.currency,
        product: stripeCatalog.onboardingSetup.productId,
        unit_amount: toCents(billingBreakdown.setupFees),
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: LEASE_SETTINGS.currency,
        product: stripeCatalog.weeklyRental.productId,
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
  idempotencyKey,
}: {
  application: StripeApplication;
  billingBreakdown: BillingBreakdown;
  car: StripeCar;
  checkoutToken: string;
  idempotencyKey: string;
}) => {
  const metadata = {
    application_id: String(application.id),
    car_id: String(car.id),
    checkout_kind: 'vehicle',
    approved_bond: billingBreakdown.bond.toFixed(2),
    approved_weekly_price: billingBreakdown.recurringAmount.toFixed(2),
    payment_link_version: String(Number(application.payment_link_version || 0)),
  };

  return getStripe().checkout.sessions.create(
    {
      billing_address_collection: 'auto',
      cancel_url: buildCancelUrl({
        applicationId: application.id,
        carId: car.id,
        token: checkoutToken,
      }),
      client_reference_id: String(application.id),
      customer_email: application.email,
      line_items: await buildSubscriptionLineItems({ billingBreakdown }),
      metadata,
      mode: 'subscription',
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
      idempotencyKey,
    }
  );
};

const fetchApplication = async (applicationId: string) => {
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

const fetchAgreementContent = async ({
  application,
  car,
}: {
  application: StripeApplication;
  car: StripeCar;
}) => {
  const { data, error } = await db
    .from('lease_agreements')
    .select('content')
    .eq('application_id', application.id)
    .eq('car_id', car.id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch saved lease agreement:', error);
  } else if (data?.content) {
    return String(data.content);
  }

  return renderApplicationLeaseAgreement(
    application as Record<string, any>,
    car as Record<string, any>,
    toFloat(application.approved_weekly_price),
    String(application.approved_at || new Date().toISOString()),
    toFloat(application.approved_bond)
  );
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
    throw new Error('This payment has already been received and activation is pending.');
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
    await getStripe().checkout.sessions.expire(sessionId);
  } catch (error) {
    console.warn(`Unable to expire checkout session ${sessionId}:`, error);
  }
};

const persistPendingCheckoutSessionId = async (
  applicationId: string,
  paymentLinkVersion: number,
  sessionId: string | null
) => {
  const didPersist = await persistPendingCheckoutSessionIdIfCurrentVersion({
    applicationId,
    expectedPaymentLinkVersion: paymentLinkVersion,
    sessionId,
  });

  return didPersist;
};

const resolvePendingCheckoutSession = async ({
  application,
  carId,
}: {
  application: StripeApplication;
  carId: number;
}): Promise<PendingCheckoutSessionResolution> => {
  const pendingSessionId = application.pending_checkout_session_id;
  if (!pendingSessionId) {
    return {
      retryKeySeed: null,
      session: null,
    };
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(pendingSessionId);
    const sessionVersion = Number(session.metadata?.payment_link_version || 0);
    const sessionCarId = Number(session.metadata?.car_id || 0);
    const sessionApplicationId = normalizeUuid(session.metadata?.application_id || '');

    const isSameContext =
      sessionApplicationId === normalizeUuid(application.id) &&
      sessionCarId === carId &&
      sessionVersion === Number(application.payment_link_version || 0);

    if (
      isSameContext &&
      (session.status === 'open' || session.status === 'complete')
    ) {
      return {
        retryKeySeed: null,
        session,
      };
    }
  } catch (error) {
    console.warn(`Unable to reuse checkout session ${pendingSessionId}:`, error);
  }

  return {
    retryKeySeed: pendingSessionId,
    session: null,
  };
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
        application_id: uuidSchema,
        car_id: z.coerce.number().int().positive(),
        checkout_token: z.string().min(1).optional(),
      })
      .parse(req.query);
    const resolvedCheckoutToken = getCheckoutTokenFromRequest(req, checkout_token);

    if (!resolvedCheckoutToken) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [
          {
            code: 'custom',
            message: 'checkout_token is required',
            path: ['checkout_token'],
          },
        ],
      });
    }

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
      token: resolvedCheckoutToken,
      version: Number(application.payment_link_version || 0),
    });
    requireApprovedPaymentContext({ application, carId: car_id });

    if (car.status !== 'Available') {
      throw new Error('Selected vehicle is no longer available.');
    }

    await assertVehicleAllocationAvailable({
      applicationId: application_id,
      carId: car_id,
      message:
        'This payment link is no longer active because the vehicle has been allocated elsewhere. Contact Maple Rentals for a fresh link.',
    });

    const [billing, agreement] = await Promise.all([
      Promise.resolve(buildApprovedBillingBreakdown(application)),
      fetchAgreementContent({ application, car }),
    ]);

    res.json({
      agreement,
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
        error.message.toLowerCase().includes('manual review') ||
        error.message.toLowerCase().includes('activation is pending'))
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
    const lockKey = `vehicle-checkout:${application_id}`;
    assertTransactionalPaymentProcessing();

    const responsePayload = await withPostgresAdvisoryLock<HostedCheckoutSessionResponse>(
      lockKey,
      async () => {
        const [application, car] = await Promise.all([
          fetchApplication(application_id),
          fetchCar(car_id),
        ]);

        if (!application) {
          throw new Error('Application not found');
        }

        if (!car) {
          throw new Error('Car not found');
        }

        verifyCheckoutToken({
          applicationId: application_id,
          carId: car_id,
          purpose: 'vehicle',
          token: checkout_token,
          version: Number(application.payment_link_version || 0),
        });
        requireApprovedPaymentContext({ application, carId: car_id });

        await assertVehicleAllocationAvailable({          applicationId: application_id,
          carId: car_id,
          message:
            'This payment link is no longer active because the vehicle has been allocated elsewhere. Contact Maple Rentals for a fresh link.',
        });

        if (car.status !== 'Available') {
          throw new Error('Selected vehicle is no longer available.');
        }

        const pendingSessionResolution = await resolvePendingCheckoutSession({
          application,
          carId: car.id,
        });

        if (pendingSessionResolution.session) {
          if (pendingSessionResolution.session.status === 'complete') {
            throw new Error('Payment has already been received and is being processed.');
          }

          if (pendingSessionResolution.session.url) {
            return {
              checkout_url: pendingSessionResolution.session.url,
              session_id: pendingSessionResolution.session.id,
            };
          }
        }

        const session = await createHostedCheckoutSession({
          application,
          billingBreakdown: buildApprovedBillingBreakdown(application),
          car,
          checkoutToken: checkout_token,
          idempotencyKey: buildHostedCheckoutSessionIdempotencyKey({
            applicationId: application.id,
            paymentLinkVersion: Number(application.payment_link_version || 0),
            retryKeySeed: pendingSessionResolution.retryKeySeed,
          }),
        });
        const didPersistSession = await persistPendingCheckoutSessionId(
          application_id,
          Number(application.payment_link_version || 0),
          session.id
        );

        if (!didPersistSession) {
          await expirePendingCheckoutSession(session.id);
          throw new Error(
            'Payment link is no longer active. Please reload the latest link.'
          );
        }

        return {
          checkout_url: session.url,
          session_id: session.id,
        };
      }
    );

    res.json(responsePayload);
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
      (error.message === 'Application not found' || error.message === 'Car not found')
    ) {
      return res.status(404).json({ error: error.message });
    }

    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes('payment link') ||
        error.message.toLowerCase().includes('manual review') ||
        error.message.toLowerCase().includes('activation is pending') ||
        error.message.toLowerCase().includes('no longer available') ||
        error.message.toLowerCase().includes('reload the latest link'))
    ) {
      return res.status(409).json({ error: error.message });
    }

    if (error instanceof Error && 'status' in error && error.status === 503) {
      return res.status(503).json({
        error: error.message,
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
    assertTransactionalPaymentProcessing(ADMIN_PAYMENTS_RESTRICTED_MESSAGE);
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

    requireApprovedPaymentContext({
      application,
      carId: Number(application.assigned_car_id),
    });

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
    const updatedApplication =
      await updateApplicationPaymentStateIfCurrentVersion({
        applicationId: application_id,
        expectedPaymentLinkVersion: Number(application.payment_link_version || 0),
        payload: {
          payment_link_sent_at: new Date().toISOString(),
          payment_link_version: nextVersion,
          pending_checkout_session_id: null,
        },
      });

    if (!updatedApplication) {
      return res.status(409).json({
        error:
          'Payment link details changed while generating a new link. Refresh and try again.',
      });
    }

    const checkoutToken = createCheckoutToken({
      applicationId: application_id,
      carId: car.id,
      purpose: 'vehicle',
      version: Number(updatedApplication.payment_link_version || nextVersion),
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

    if (error instanceof Error && 'status' in error && error.status === 503) {
      return res.status(503).json({ error: error.message });
    }

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('payment link')
    ) {
      return res.status(409).json({ error: error.message });
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
        application_id: uuidSchema,
        car_id: z.coerce.number().int().positive(),
        checkout_token: z.string().min(1).optional(),
      })
      .parse(req.query);
    const resolvedCheckoutToken = getCheckoutTokenFromRequest(req, checkout_token);

    if (!resolvedCheckoutToken) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [
          {
            code: 'custom',
            message: 'checkout_token is required',
            path: ['checkout_token'],
          },
        ],
      });
    }

    const application = await fetchApplication(application_id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    verifyCheckoutToken({
      applicationId: application_id,
      carId: car_id,
      purpose: 'vehicle',
      token: resolvedCheckoutToken,
      version: Number(application.payment_link_version || 0),
    });

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const metadataApplicationId = normalizeUuid(session.metadata?.application_id || '');
    const metadataCarId = toOptionalPositiveInt(session.metadata?.car_id);
    const metadataCheckoutKind = session.metadata?.checkout_kind || null;
    const metadataVersion = Number(session.metadata?.payment_link_version || 0);

    if (metadataApplicationId !== normalizeUuid(application_id)) {
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
      .maybeSingle();

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
