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
  getSchemaCompat,
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
import {
  persistPendingCheckoutSessionIdIfCurrentVersion,
  updateApplicationPaymentStateIfCurrentVersion,
} from '../applicationPaymentState.js';
import { LEASE_SETTINGS, RENTAL_PLAN_SETUP_FEES_AUD } from '../constants.js';
import { normalizeUuid } from '../../shared/uuid.js';

const getStripe = () => getStripeClient();
const DEFAULT_VEHICLE_IMAGE = '/hero-camry.webp';
const DEFAULT_APPROVED_VEHICLE_LABEL = 'Approved vehicle to be confirmed by Maple Rentals';

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
  applicant_name: string;
  application_id: string;
  approved_vehicle: string;
  billing: BillingBreakdown;
  car_id: number;
  vehicle_image: string;
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
  approved_vehicle?: string | null;
  approved_weekly_price?: number | string | null;
  email: string;
  id: string;
  name: string;
  payment_link_version?: number | null;
  pending_checkout_session_id?: string | null;
  status: string;
};

type CheckoutVehicle = {
  archived_at?: string | null;
  id: number | string;
  name?: string | null;
  status?: string | null;
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));
const toFloat = (value: number | string | null | undefined) =>
  Number(Number(value || 0).toFixed(2));
const isLiveRentalStatus = (status: unknown) => {
  const normalized = String(status || '').toLowerCase();
  return normalized !== 'completed' && normalized !== 'cancelled';
};

const requireCheckoutTokenCarId = (carId: unknown) => {
  const numericCarId = Number(carId || 0);

  if (!Number.isInteger(numericCarId) || numericCarId <= 0) {
    throw new Error(
      'Payment link is missing a vehicle assignment. Request a fresh payment link.'
    );
  }

  return numericCarId;
};

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

  return lineItems.filter((item) => (item.price_data?.unit_amount ?? 0) > 0);
};

const buildCancelUrl = ({
  applicationId,
  token,
}: {
  applicationId: string;
  token: string;
}) => {
  const checkoutUrl = new URL(`/checkout/${applicationId}`, getAppBaseUrl());
  checkoutUrl.searchParams.set('resume_payment', '1');
  return appendCheckoutTokenHash(checkoutUrl, token).toString();
};

const buildSuccessUrl = ({
  applicationId,
  token,
}: {
  applicationId: string;
  token: string;
}) => {
  const url = new URL('/success', getAppBaseUrl());
  url.searchParams.set('session_id', '__STRIPE_CHECKOUT_SESSION_ID__');
  url.searchParams.set('application_id', String(applicationId));
  return appendCheckoutTokenHash(url, token)
    .toString()
    .replace('__STRIPE_CHECKOUT_SESSION_ID__', '{CHECKOUT_SESSION_ID}');
};

const createHostedCheckoutSession = async ({
  application,
  billingBreakdown,
  carId,
  checkoutToken,
  idempotencyKey,
}: {
  application: StripeApplication;
  billingBreakdown: BillingBreakdown;
  carId: number;
  checkoutToken: string;
  idempotencyKey: string;
}) => {
  const metadata = {
    application_id: String(application.id),
    applicant_email: String(application.email),
    approved_vehicle: String(application.approved_vehicle || DEFAULT_APPROVED_VEHICLE_LABEL),
    car_id: String(carId),
    checkout_kind: 'vehicle',
    payment_type: 'vehicle_rental',
    approved_bond: billingBreakdown.bond.toFixed(2),
    approved_weekly_price: billingBreakdown.recurringAmount.toFixed(2),
    payment_link_version: String(Number(application.payment_link_version || 0)),
  };

  return getStripe().checkout.sessions.create(
    {
      billing_address_collection: 'auto',
      cancel_url: buildCancelUrl({
        applicationId: application.id,
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

const fetchCheckoutVehicle = async (carId: number) => {
  const selectColumns = await getCarSelectColumns();
  const { data: car, error } = await db
    .from('cars')
    .select(selectColumns)
    .eq('id', carId)
    .single();

  if (error || !car) {
    return null;
  }

  return car as unknown as CheckoutVehicle;
};

const requireCheckoutVehicleAvailable = async (carId: number) => {
  const car = await fetchCheckoutVehicle(carId);

  if (!car) {
    throw new Error('Car not found');
  }

  if (car.archived_at) {
    throw new Error(
      'Vehicle is no longer available for checkout. Request a fresh payment link.'
    );
  }

  if (String(car.status || '') !== 'Available') {
    throw new Error(
      'Vehicle is no longer available for checkout. Request a fresh payment link.'
    );
  }

  return car;
};

const requireApprovedPaymentContext = ({
  application,
}: {
  application: StripeApplication;
}) => {
  if (application.status === 'Paid') {
    throw new Error('Payment link has already been used.');
  }

  if (application.status === 'Payment Review') {
    throw new Error('This payment has already been received and onboarding follow-up is pending.');
  }

  if (application.status !== 'Approved') {
    throw new Error('Payment link is not ready for payment yet.');
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
  return persistPendingCheckoutSessionIdIfCurrentVersion({
    applicationId,
    expectedPaymentLinkVersion: paymentLinkVersion,
    sessionId,
  });
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
    const sessionApplicationId = normalizeUuid(session.metadata?.application_id || '');
    const sessionCarId = Number(session.metadata?.car_id || 0);
    const isSameContext =
      sessionApplicationId === normalizeUuid(application.id) &&
      sessionVersion === Number(application.payment_link_version || 0) &&
      session.metadata?.checkout_kind === 'vehicle' &&
      sessionCarId === carId;

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
  checkoutToken,
}: {
  applicationId: string;
  checkoutToken: string;
}): Promise<VehiclePaymentContextResponse> => {
  const application = await fetchApplication(applicationId);

  if (!application) {
    throw new Error('Application not found');
  }

  const checkoutTokenPayload = verifyCheckoutToken({
    applicationId,
    purpose: 'vehicle',
    token: checkoutToken,
    version: Number(application.payment_link_version || 0),
  });
  const carId = requireCheckoutTokenCarId(checkoutTokenPayload.carId);
  await requireCheckoutVehicleAvailable(carId);
  requireApprovedPaymentContext({ application });

  return {
    applicant_name: application.name,
    application_id: applicationId,
    approved_vehicle: String(application.approved_vehicle || DEFAULT_APPROVED_VEHICLE_LABEL),
    billing: buildApprovedBillingBreakdown(application),
    car_id: carId,
    vehicle_image: DEFAULT_VEHICLE_IMAGE,
  };
};

export const createVehicleCheckoutSession = async ({
  applicationId,
  checkoutToken,
}: {
  applicationId: string;
  checkoutToken: string;
}): Promise<HostedCheckoutSessionResponse> => {
  return withOptionalCheckoutSessionLock<HostedCheckoutSessionResponse>(applicationId, async () => {
    const application = await fetchApplication(applicationId);

    if (!application) {
      throw new Error('Application not found');
    }

    const checkoutTokenPayload = verifyCheckoutToken({
      applicationId,
      purpose: 'vehicle',
      token: checkoutToken,
      version: Number(application.payment_link_version || 0),
    });
    const carId = requireCheckoutTokenCarId(checkoutTokenPayload.carId);
    await requireCheckoutVehicleAvailable(carId);
    requireApprovedPaymentContext({ application });

    const pendingSessionResolution = await resolvePendingCheckoutSession({
      application,
      carId,
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
      carId,
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
  carId,
}: {
  applicationId: string;
  carId: number;
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

  requireApprovedPaymentContext({
    application,
  });
  await requireCheckoutVehicleAvailable(carId);

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
    carId,
    purpose: 'vehicle',
    version: Number(updatedApplication.payment_link_version || nextVersion),
  });

  return {
    checkout_token: checkoutToken.token,
    checkout_token_expires_at: checkoutToken.expiresAt,
    checkout_url: buildDriverPaymentLink({
      applicationId,
      token: checkoutToken.token,
    }),
  };
};

const getConfirmedRentalStatus = async ({
  applicationId,
  carId,
  subscriptionId,
}: {
  applicationId: string;
  carId: number;
  subscriptionId: string | null;
}) => {
  const compat = await getSchemaCompat();
  const rentalApplicationIdColumn = await getRentalApplicationIdColumn();
  const rentalCarIdColumn = await getRentalCarIdColumn();
  const selectColumns = [
    'id',
    'status',
    rentalApplicationIdColumn,
    rentalCarIdColumn,
    compat.rentalStripeSubscriptionColumn,
  ]
    .filter((column): column is string => Boolean(column))
    .join(', ');
  const { data, error } = await db
    .from('rentals')
    .select(selectColumns)
    .eq(rentalApplicationIdColumn, applicationId)
    .eq(rentalCarIdColumn, carId);

  if (error) {
    throw new Error(
      `Failed to inspect local rental activation state: ${error.message || 'Unknown error'}`
    );
  }

  const rentals = ((data || []) as unknown) as Array<Record<string, unknown>>;
  const liveRentals = rentals.filter((rental) => isLiveRentalStatus(rental.status));
  const subscriptionColumn = compat.rentalStripeSubscriptionColumn;
  const matchingSubscriptionRental =
    subscriptionId && subscriptionColumn
      ? liveRentals.find(
          (rental) => String(rental[subscriptionColumn] || '') === subscriptionId
        )
      : null;
  const matchingRental = matchingSubscriptionRental || liveRentals[0];

  return matchingRental ? String(matchingRental.status || '') || null : null;
};

export const getVehicleCheckoutSessionStatus = async ({
  applicationId,
  checkoutToken,
  sessionId,
}: {
  applicationId: string;
  checkoutToken: string;
  sessionId: string;
}): Promise<VehicleCheckoutSessionStatusResponse> => {
  const application = await fetchApplication(applicationId);

  if (!application) {
    throw new Error('Application not found');
  }

  const checkoutTokenPayload = verifyCheckoutToken({
    applicationId,
    purpose: 'vehicle',
    token: checkoutToken,
    version: Number(application.payment_link_version || 0),
  });
  const carId = requireCheckoutTokenCarId(checkoutTokenPayload.carId);

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const metadataApplicationId = normalizeUuid(session.metadata?.application_id || '');
  const metadataCarId = Number(session.metadata?.car_id || 0);
  const metadataCheckoutKind = session.metadata?.checkout_kind || null;
  const metadataVersion = Number(session.metadata?.payment_link_version || 0);
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null;

  if (metadataApplicationId !== normalizeUuid(applicationId)) {
    throw new Error('Checkout session does not match this application.');
  }

  if (metadataCheckoutKind !== 'vehicle') {
    throw new Error('Checkout session does not match this payment link.');
  }

  if (metadataCarId !== carId) {
    throw new Error('Checkout session vehicle does not match this payment link.');
  }

  if (metadataVersion !== Number(application.payment_link_version || 0)) {
    throw new Error('Checkout session belongs to an outdated payment link.');
  }

  const rentalStatus = await getConfirmedRentalStatus({
    applicationId,
    carId,
    subscriptionId,
  });
  const isStripePaidComplete =
    session.status === 'complete' && session.payment_status === 'paid';
  const internalStatus =
    application.status === 'Paid' && rentalStatus
      ? 'complete'
      : isStripePaidComplete &&
          (application.status === 'Payment Review' || application.status === 'Paid')
        ? 'manual_review'
        : isStripePaidComplete
          ? 'pending'
          : 'open';

  return {
    application_status: application.status,
    checkout_kind: metadataCheckoutKind,
    id: session.id,
    internal_status: internalStatus,
    payment_status: session.payment_status,
    rental_status: rentalStatus,
    status: session.status,
  };
};
