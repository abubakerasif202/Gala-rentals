import './load-env.js';

import { STRIPE_API_VERSION } from '../api/constants.js';
import { ensureStripeCatalog } from '../api/stripeCatalog.js';
import { createStripeClient, requireStripeSecretKey } from '../api/stripeClient.js';

const stripeSecretKey = requireStripeSecretKey();
const stripe = createStripeClient(stripeSecretKey);

const account = await stripe.accounts.retrieve();
const catalog = await ensureStripeCatalog(stripe);

const summary = {
  accountId: account.id,
  apiVersion: STRIPE_API_VERSION,
  catalog,
  hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  keyMode: stripeSecretKey.startsWith('sk_test_')
    ? 'test'
    : stripeSecretKey.startsWith('sk_live_')
      ? 'live'
      : 'unknown',
};

console.log(JSON.stringify(summary, null, 2));
