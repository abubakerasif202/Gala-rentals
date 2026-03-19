import Stripe from 'stripe';

import { STRIPE_CONFIG } from './constants.js';

let cachedStripeClient: Stripe | null = null;
let cachedStripeSecretKey: string | null = null;

export const readStripeSecretKey = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  return secretKey ? secretKey : null;
};

export const requireStripeSecretKey = () => {
  const secretKey = readStripeSecretKey();

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required.');
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
