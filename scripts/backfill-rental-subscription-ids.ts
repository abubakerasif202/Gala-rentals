import './load-env.js';

import pg from 'pg';

import {
  createStripeClient,
  readStripeSecretKey,
} from '../api/stripeClient.js';

const { Client } = pg;

type BackfillMode = 'apply' | 'dry_run';

type BackfillSummary = {
  attempted: number;
  failed: number;
  skipped: number;
  succeeded: number;
};

type RentalCandidate = {
  application_id: number;
  id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const args = new Set(process.argv.slice(2));
const mode: BackfillMode = args.has('--apply') ? 'apply' : 'dry_run';
const forceProduction = args.has('--force-production');
const maxRowsArg = [...args].find((arg) => arg.startsWith('--max='));
const maxRows = maxRowsArg ? Number(maxRowsArg.split('=')[1]) : 250;

if (!Number.isFinite(maxRows) || maxRows <= 0) {
  throw new Error('Expected --max=<positive number> when provided.');
}

if (mode === 'apply' && process.env.ALLOW_SUBSCRIPTION_BACKFILL !== 'true') {
  throw new Error(
    'Set ALLOW_SUBSCRIPTION_BACKFILL=true before running apply mode.'
  );
}

const stripeSecretKey = readStripeSecretKey();
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is required for subscription backfill.');
}

if (!stripeSecretKey.startsWith('sk_test_') && !forceProduction) {
  throw new Error(
    'Refusing to run against a live Stripe key without --force-production.'
  );
}

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
if (!connectionString) {
  throw new Error('DATABASE_URL or SUPABASE_DB_URL is required.');
}

const stripe = createStripeClient(stripeSecretKey);
const client = new Client({ connectionString });

const summary: BackfillSummary = {
  attempted: 0,
  failed: 0,
  skipped: 0,
  succeeded: 0,
};

const truncateForSqlComment = (message: string) =>
  message.replace(/[\r\n\t]+/g, ' ').slice(0, 180);

const fetchCandidateRentals = async (): Promise<RentalCandidate[]> => {
  const { rows } = await client.query<RentalCandidate>(
    `SELECT id, application_id, stripe_customer_id, stripe_subscription_id
       FROM rentals
      WHERE (stripe_subscription_id IS NULL OR stripe_subscription_id = '')
      ORDER BY id ASC
      LIMIT $1`,
    [maxRows]
  );

  return rows;
};

const parseNumeric = (value: string | undefined) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const findMatchingSubscriptionsForRental = async (rental: RentalCandidate) => {
  const subscriptions = await stripe.subscriptions.list({
    customer: rental.stripe_customer_id || undefined,
    limit: 100,
    status: 'all',
  });

  const expectedApplicationId = rental.application_id;
  const candidates = subscriptions.data
    .filter((subscription) => ['active', 'past_due', 'unpaid', 'trialing'].includes(subscription.status))
    .filter((subscription) => {
      const metadataApplicationId = parseNumeric(subscription.metadata?.application_id);
      return metadataApplicationId === expectedApplicationId;
    })
    .sort((left, right) => right.created - left.created);

  return candidates;
};

const updateSubscriptionId = async (rentalId: number, subscriptionId: string) => {
  await client.query(
    `UPDATE rentals
        SET stripe_subscription_id = $1
      WHERE id = $2`,
    [subscriptionId, rentalId]
  );
};

const run = async () => {
  await client.connect();

  console.log(
    JSON.stringify(
      {
        forceProduction,
        keyMode: stripeSecretKey.startsWith('sk_test_') ? 'test' : 'live',
        maxRows,
        mode,
      },
      null,
      2
    )
  );

  const candidates = await fetchCandidateRentals();
  console.log(`Found ${candidates.length} rental rows missing stripe_subscription_id.`);

  for (const rental of candidates) {
    summary.attempted += 1;

    if (!rental.stripe_customer_id) {
      summary.skipped += 1;
      console.log(
        `[skip] rental ${rental.id} application ${rental.application_id}: missing stripe_customer_id`
      );
      continue;
    }

    try {
      const subscriptions = await findMatchingSubscriptionsForRental(rental);

      if (subscriptions.length > 1) {
        summary.skipped += 1;
        console.log(
          `[skip] rental ${rental.id} application ${rental.application_id}: multiple matching subscriptions (${subscriptions
            .map((item) => item.id)
            .join(', ')})`
        );
        continue;
      }

      const subscription = subscriptions[0] || null;

      if (!subscription) {
        summary.skipped += 1;
        console.log(
          `[skip] rental ${rental.id} application ${rental.application_id}: no active/recent Stripe subscription with matching application metadata for customer ${rental.stripe_customer_id}`
        );
        continue;
      }

      if (mode === 'dry_run') {
        summary.succeeded += 1;
        console.log(
          `[dry-run] rental ${rental.id}: would set stripe_subscription_id=${subscription.id} (status=${subscription.status})`
        );
        continue;
      }

      await updateSubscriptionId(rental.id, subscription.id);
      summary.succeeded += 1;
      console.log(
        `[done] rental ${rental.id}: stripe_subscription_id=${subscription.id} (status=${subscription.status})`
      );
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[failed] rental ${rental.id} application ${rental.application_id}: ${truncateForSqlComment(message)}`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        summary,
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error('Backfill execution failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
