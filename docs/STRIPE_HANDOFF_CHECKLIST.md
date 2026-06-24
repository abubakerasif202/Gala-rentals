# Stripe Handoff Checklist

Use this checklist before handing Gala Rental over to a client or switching from sandbox to production.

## Required environment variables

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_LINK_SECRET`
- `APP_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

Recommended for transactional payment-state recording:

- `SUPABASE_DB_URL` or `DATABASE_URL`

## Required Stripe behavior

- Checkout runs in `subscription` mode.
- The app creates hosted Checkout Sessions on the server.
- Final paid state depends on verified Stripe webhooks hitting `POST /api/stripe/webhook`.
- Gala Rentals is intentionally payment-only after checkout: successful payment marks the application `Paid`, stores Stripe identifiers, clears the pending session, and does not mutate car status or create rental rows automatically.
- Transactional payment-state recording requires a session-capable Postgres connection on port `5432`.
- Without that direct Postgres connection, successful payments can fall back to `Payment Review` for operator follow-up.

## Pre-handover commands

Run these from the repository root:

```bash
npm run validate
npm run verify:schema-contract
npm run stripe:handoff
```

Expected results:

- `npm run validate` passes.
- `npm run verify:schema-contract` passes with no missing columns.
- `npm run stripe:handoff` returns `overallStatus: "pass"` for full payment-state readiness, or `overallStatus: "warn"` if manual-review mode is the only remaining non-live issue.

If the schema check fails because `stripe_webhook_events` is missing `status` or `received_at`, run:

```bash
npm run migrate:stripe-webhook-ledger
```

## Stripe dashboard checks

- Confirm the correct account is selected.
- Confirm the API keys used by the deployment are current and unexpired.
- Confirm the production webhook endpoint exists and points to:
  - `https://<your-domain>/api/stripe/webhook`
- Confirm the webhook endpoint is subscribed to:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Confirm the reusable catalog exists:
  - `Security Bond`
  - `Onboarding setup fees`
  - `Weekly vehicle rental`

## App-level checks

- `APP_URL` matches the final public domain exactly.
- `/api/health` returns:

```json
{
  "status": "ok",
  "paymentActivationMode": "transactional"
}
```

If the deployment intentionally runs without a session-capable Postgres connection, expect `paymentActivationMode: "restricted"` and verify the team is prepared to review paid applications from `Payment Review`.

- Payment links open the correct public `/checkout/:applicationId` URL with a signed checkout token.
- Successful Checkout redirects back to `/success` on the same domain.
- A successful payment marks the application `Paid`, stores Stripe customer, checkout session, subscription, invoice, and payment intent identifiers when Stripe provides them, and does not auto-create rentals.
- Failed recurring invoices and subscription lifecycle events only update rentals that already have a strict Stripe subscription identity.
- Subscription deletion does not release any vehicle unless an existing rental identity proves it is safe.

## Test before go-live

- Complete one successful sandbox Checkout flow.
- Confirm the webhook is received and processed once.
- Confirm replayed webhook deliveries do not duplicate payment fulfillment.
- Confirm the application moves to `Paid`, the pending checkout session clears, and no car status or rental row is created automatically.
- Confirm the customer receives the expected email if `RESEND_API_KEY` is configured.
- Confirm admin financials can load Stripe payouts if that feature is expected in the handoff.

## Go-live notes

- Rotate any development-era Stripe keys before launch.
- Do not reuse sandbox products, prices, or webhook endpoints in live mode.
- Do not change the pinned Stripe API version without retesting checkout and webhook flows.
- Keep a copy of the Stripe dashboard API keys page and webhook endpoint settings in the client handoff pack.
