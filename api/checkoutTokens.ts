import crypto from 'node:crypto';

export type CheckoutTokenPurpose = 'application' | 'vehicle';

type CheckoutTokenPayload = {
  applicationId: number;
  carId: number | null;
  expiresAt: number;
  purpose: CheckoutTokenPurpose;
};

const DEFAULT_TOKEN_TTL_HOURS = 24 * 7;

const getCheckoutLinkSecret = () => {
  const secret = process.env.CHECKOUT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) {
    throw new Error('CHECKOUT_LINK_SECRET or SUPABASE_SERVICE_ROLE_KEY is required to mint checkout tokens.');
  }
  return secret;
};

const signTokenValue = (value: string) =>
  crypto.createHmac('sha256', getCheckoutLinkSecret()).update(value).digest('base64url');

const toTokenPayload = (payload: CheckoutTokenPayload) =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

const fromTokenPayload = (payload: string): CheckoutTokenPayload => {
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(decoded) as CheckoutTokenPayload;
};

export const createCheckoutToken = ({
  applicationId,
  carId = null,
  expiresInHours = DEFAULT_TOKEN_TTL_HOURS,
  purpose,
}: {
  applicationId: number;
  carId?: number | null;
  expiresInHours?: number;
  purpose: CheckoutTokenPurpose;
}) => {
  const payload = toTokenPayload({
    applicationId,
    carId,
    expiresAt: Date.now() + expiresInHours * 60 * 60 * 1000,
    purpose,
  });
  const signature = signTokenValue(payload);

  return {
    expiresAt: new Date(fromTokenPayload(payload).expiresAt).toISOString(),
    token: `${payload}.${signature}`,
  };
};

export const verifyCheckoutToken = ({
  applicationId,
  carId = null,
  purpose,
  token,
}: {
  applicationId: number;
  carId?: number | null;
  purpose: CheckoutTokenPurpose;
  token: string;
}) => {
  const [encodedPayload, providedSignature] = token.split('.');

  if (!encodedPayload || !providedSignature) {
    throw new Error('Invalid checkout token.');
  }

  const expectedSignature = signTokenValue(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid checkout token signature.');
  }

  const payload = fromTokenPayload(encodedPayload);

  if (payload.purpose !== purpose) {
    throw new Error('Checkout token purpose mismatch.');
  }

  if (payload.applicationId !== applicationId) {
    throw new Error('Checkout token application mismatch.');
  }

  if ((payload.carId ?? null) !== carId) {
    throw new Error('Checkout token car mismatch.');
  }

  if (payload.expiresAt <= Date.now()) {
    throw new Error('Checkout token has expired.');
  }

  return payload;
};
