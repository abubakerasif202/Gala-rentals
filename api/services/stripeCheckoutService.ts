import Stripe from 'stripe';

import { db } from '../db/index.js';
import {
  hasDirectDatabaseConnection,
  withPostgresAdvisoryLock,
} from '../db/postgres.js';
import { ensureStripeCatalog } from '../stripeCatalog.js';
import { getStripeClient } from '../stripeClient.js';
import {
  getApplicationSelectColumns,
  getCarSelectColumns,
  getRentalApplicationIdColumn,
  getRentalCarIdColumn,
} from '../schemaCompat.js';
import {
  createCheckoutToken,
  verifyCheckoutToken,
} from '../checkoutTokens.js';
import {
  buildDriverPaymentLink,
  appendCheckoutTokenHash,
  getAppBaseUrl,
} from '../paymentLinks.js';
import { getTodayInAustralia } from '../../shared/applicationSubmission.js';
import { renderApplicationLeaseAgreement } from '../agreementGeneration.js';
import { assertVehicleAllocationAvailable } from '../vehicleAllocations.js';
import { LEASE_SETTINGS, RENTAL_PLAN_SETUP_FEES_AUD } from '../constants.js';
import { normalizeUuid } from '../../shared/uuid.js';
import {
  persistPendingCheckoutSessionIdIfCurrentVersion,
  updateApplicationPaymentStateIfCurrentVersion,
} from '../applicationPaymentState.js';

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

export type HostedCheckoutSessionResponse = {
  checkout_url: string | null;
  session_id: string;
};

export type VehiclePaymentContextResponse = {
  agreement: string;
  applicant_name: string;
  application_id: string;
  billing: BillingBreakdown;
  car: Record<string, unknown>;
};

export type VehicleCheckoutSessionStatusResponse = {
  application_status: string;
  checkout_kind: string | null;
  id: string;
  internal_status: 'complete' | 'manual_review' | 'open' | 'pending';
  payment_status: string | null;
  rental_status: string | null;
  status: string;
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

const toFloat = (value: number | string | null | undefined) =>
  Number(Number(value || 0).toFixed(2));

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

const buildApprovedBillingBreakdown = (application: StripeApplication): BillingBreakdown => {
  const approvedBondCents = Math.round(Number(application.approved_bond || 0) * 100);
  const approvedWeeklyPriceCents = Math.round(
    Number(application.approved_weekly_price || 0) * 100
  );
  const setupFeesCents = Math.round(RENTAL_PLAN_SETUP_FEES_AUD * 100);
  const upfrontDueCents = approvedBondCents + approvedWeeklyPriceCents + setupFeesCents;

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
  url.searchParams.set('session_id', '__STRIPE_CHECKOUT_SESSION_ID__');
  url.searchParams.set('application_id', String(applicationId));
  url.searchParams.set('car_id', String(carId));
  return appendCheckoutTokenHash(url, token)
    .toString()
    .replace('__STRIPE_CHECKOUT_SESSION_ID__', '{CHECKOUT_SESSION_ID}');
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

const withOptionalCheckoutSessionLock = async <T>(
  applicationId: string,
  callback: () => Promise<T>
) => {
  if (!hasDirectDatabaseConnection()) {
    return callback();
  }

  return withPostgresAdvisoryLock(`vehicle-checkout:${applicationId}`, callback);
};

export const buildHostedCheckoutSessionIdempotencyKey = ({
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

export const resolvePendingCheckoutSession = async ({
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

    if (isSameContext && (session.status === 'open' || session.status === 'complete')) {
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

export const getVehiclePaymentContext = async ({
  applicationId,
  carId,
  checkoutToken,
}: {
  applicationId: string;
  carId: number;
  checkoutToken: string;
}): Promise<VehiclePaymentContextResponse> => {
  const [application, car] = await Promise.all([
    fetchApplication(applicationId),
    fetchCar(carId),
  ]);

  if (!application) {
    throw new Error('Application not found');
  }

  if (!car) {
    throw new Error('Car not found');
  }

  verifyCheckoutToken({
    applicationId,
    carId,
    purpose: 'vehicle',
    token: checkoutToken,
    version: Number(application.payment_link_version || 0),
  });
  requireApprovedPaymentContext({ application, carId });

  if (car.status !== 'Available') {
    throw new Error('Selected vehicle is no longer available.');
  }

  await assertVehicleAllocationAvailable({
    applicationId,
    carId,
    message:
      'This payment link is no longer active because the vehicle has been allocated elsewhere. Contact Maple Rentals for a fresh link.',
  });

  const [billing, agreement] = await Promise.all([
    Promise.resolve(buildApprovedBillingBreakdown(application)),
    fetchAgreementContent({ application, car }),
  ]);

  return {
    agreement,
    applicant_name: application.name,
    application_id: applicationId,
    billing,
    car,
  };
};

export const createVehicleCheckoutSession = async ({
  applicationId,
  carId,
  checkoutToken,
}: {
  applicationId: string;
  carId: number;
  checkoutToken: string;
}): Promise<HostedCheckoutSessionResponse> => {
  return withOptionalCheckoutSessionLock<HostedCheckoutSessionResponse>(applicationId, async () => {
    const [application, car] = await Promise.all([
      fetchApplication(applicationId),
      fetchCar(carId),
    ]);

    if (!application) {
      throw new Error('Application not found');
    }

    if (!car) {
      throw new Error('Car not found');
    }

    verifyCheckoutToken({
      applicationId,
      carId,
      purpose: 'vehicle',
      token: checkoutToken,
      version: Number(application.payment_link_version || 0),
    });
    requireApprovedPaymentContext({ application, carId });

    await assertVehicleAllocationAvailable({
      applicationId,
      carId,
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
      checkoutToken,
      idempotencyKey: buildHostedCheckoutSessionIdempotencyKey({
        applicationId: application.id,
        paymentLinkVersion: Number(application.payment_link_version || 0),
        retryKeySeed: pendingSessionResolution.retryKeySeed,
      }),
    });
    const didPersistSession = await persistPendingCheckoutSessionId(
      applicationId,
      Number(application.payment_link_version || 0),
      session.id
    );

    if (!didPersistSession) {
      await expirePendingCheckoutSession(session.id);
      throw new Error('Payment link is no longer active. Please reload the latest link.');
    }

    return {
      checkout_url: session.url,
      session_id: session.id,
    };
  });
};

export const createVehicleCheckoutLink = async ({
  applicationId,
}: {
  applicationId: string;
}) => {
  const application = await fetchApplication(applicationId);

  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status === 'Paid') {
    throw new Error('This application has already been paid.');
  }

  if (application.status !== 'Approved') {
    throw new Error('Approve the application and save pricing before sending a payment link.');
  }

  if (!application.assigned_car_id) {
    throw new Error('Assign a vehicle before sending a payment link.');
  }

  const car = await fetchCar(Number(application.assigned_car_id));

  if (!car) {
    throw new Error('Assigned vehicle not found');
  }

  requireApprovedPaymentContext({
    application,
    carId: Number(application.assigned_car_id),
  });

  if (car.status !== 'Available') {
    throw new Error('Assigned vehicle is not available.');
  }

  await assertVehicleAllocationAvailable({
    applicationId,
    carId: car.id,
    message:
      'This vehicle already has another active approval or payment review. Resolve that allocation first.',
  });

  const nextVersion = Number(application.payment_link_version || 0) + 1;
  await expirePendingCheckoutSession(application.pending_checkout_session_id);
  const updatedApplication =
    await updateApplicationPaymentStateIfCurrentVersion({
      applicationId,
      expectedPaymentLinkVersion: Number(application.payment_link_version || 0),
      payload: {
        payment_link_sent_at: new Date().toISOString(),
        payment_link_version: nextVersion,
        pending_checkout_session_id: null,
      },
    });

  if (!updatedApplication) {
    throw new Error('Payment link details changed while generating a new link. Refresh and try again.');
  }

  const checkoutToken = createCheckoutToken({
    applicationId,
    carId: car.id,
    purpose: 'vehicle',
    version: Number(updatedApplication.payment_link_version || nextVersion),
  });

  return {
    checkout_token: checkoutToken.token,
    checkout_token_expires_at: checkoutToken.expiresAt,
    checkout_url: buildDriverPaymentLink({
      applicationId,
      carId: car.id,
      token: checkoutToken.token,
    }),
  };
};

export const getVehicleCheckoutSessionStatus = async ({
  applicationId,
  carId,
  checkoutToken,
  sessionId,
}: {
  applicationId: string;
  carId: number;
  checkoutToken: string;
  sessionId: string;
}): Promise<VehicleCheckoutSessionStatusResponse> => {
  const application = await fetchApplication(applicationId);

  if (!application) {
    throw new Error('Application not found');
  }

  verifyCheckoutToken({
    applicationId,
    carId,
    purpose: 'vehicle',
    token: checkoutToken,
    version: Number(application.payment_link_version || 0),
  });

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const metadataApplicationId = normalizeUuid(session.metadata?.application_id || '');
  const metadataCarId = Number(session.metadata?.car_id || 0);
  const metadataCheckoutKind = session.metadata?.checkout_kind || null;
  const metadataVersion = Number(session.metadata?.payment_link_version || 0);

  if (metadataApplicationId !== normalizeUuid(applicationId)) {
    throw new Error('Checkout session does not match this application.');
  }

  if (metadataCheckoutKind !== 'vehicle') {
    throw new Error('Checkout session does not match this payment link.');
  }

  if (metadataCarId !== carId) {
    throw new Error('Checkout session does not match this vehicle link.');
  }

  if (metadataVersion !== Number(application.payment_link_version || 0)) {
    throw new Error('Checkout session belongs to an outdated payment link.');
  }

  const rentalCarIdColumn = await getRentalCarIdColumn();
  const rentalApplicationIdColumn = await getRentalApplicationIdColumn();
  const { data: rental } = await db
    .from('rentals')
    .select('id, status')
    .eq(rentalCarIdColumn, carId)
    .eq(rentalApplicationIdColumn, applicationId)
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

  return {
    application_status: application.status,
    checkout_kind: metadataCheckoutKind,
    id: session.id,
    internal_status: internalStatus,
    payment_status: session.payment_status,
    rental_status: rental?.status || null,
    status: session.status,
  };
};
