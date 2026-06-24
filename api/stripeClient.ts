import Stripe from 'stripe';

import { STRIPE_CONFIG } from './constants.js';

let cachedStripeClient: Stripe | null = null;
let cachedStripeSecretKey: string | null = null;

const STRIPE_SECRET_KEY_PREFIXES = ['sk_test_', 'sk_live_', 'rk_test_', 'rk_live_'];

export const getStripeSecretKeyConfigurationIssue = (
  value = process.env.STRIPE_SECRET_KEY
) => {
  const secretKey = value?.trim();

  if (!secretKey) {
    return 'STRIPE_SECRET_KEY is required.';
  }

  if (
    secretKey.includes('PASTE_') ||
    secretKey.includes('REPLACE') ||
    secretKey.includes('...')
  ) {
    return 'STRIPE_SECRET_KEY is still a placeholder. Set it to a real Stripe secret key.';
  }

  if (!STRIPE_SECRET_KEY_PREFIXES.some((prefix) => secretKey.startsWith(prefix))) {
    return 'STRIPE_SECRET_KEY must start with sk_test_, sk_live_, rk_test_, or rk_live_.';
  }

  return null;
};

export const readStripeSecretKey = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  return secretKey && !getStripeSecretKeyConfigurationIssue(secretKey)
    ? secretKey
    : null;
};

export const requireStripeSecretKey = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const issue = getStripeSecretKeyConfigurationIssue(secretKey);

  if (issue) {
    throw new Error(issue);
  }

  return secretKey;
};

export const createStripeClient = (secretKey: string) =>
  new Stripe(secretKey, STRIPE_CONFIG);

const getOrCreateStripeClient = (secretKey: string) => {
  if (!cachedStripeClient || cachedStripeSecretKey !== secretKey) {
    cachedStripeClient = createStripeClient(secretKey);
    cachedStripeSecretKey = secretKey;
  }

  return cachedStripeClient;
};

export const getStripeClient = () =>
  getOrCreateStripeClient(requireStripeSecretKey());

export const getOptionalStripeClient = () => {
  const secretKey = readStripeSecretKey();
  return secretKey ? getOrCreateStripeClient(secretKey) : null;
};

export const clearStripeClientCache = () => {
  cachedStripeClient = null;
  cachedStripeSecretKey = null;
};
