# Stripe Setup

This app uses Stripe Checkout in `subscription` mode for approved rental applications.

The shared Stripe client configuration is pinned to API version `2025-04-30.basil`.

## Runtime model

- The server creates Checkout Sessions dynamically from the approved bond and weekly rental price.
- The app now uses reusable Stripe catalog products instead of creating fresh inline products on each checkout.
- Canonical products are:
  - `Security Bond`
  - `Onboarding setup fees`
  - `Weekly vehicle rental`
- If the optional `STRIPE_*_PRODUCT_ID` environment variables are not set, the server will create or reuse these canonical products automatically in Stripe.

## Commands

Verify the current Stripe account and ensure the reusable catalog exists:

```bash
npm run stripe:setup
```

The JSON summary includes the resolved Stripe account mode, the configured API version, webhook-endpoint checks, and runtime readiness checks.

Run the strict client-handoff gate:

```bash
npm run stripe:handoff
```

This command fails unless all production-critical Stripe checks pass, including:

- live Stripe key mode
- `APP_URL` validity
- expected `/api/stripe/webhook` endpoint registration
- required webhook events
- payment activation mode (`transactional` or manual-review fallback)
- production schema contract readiness

Preview a destructive Stripe test-data reset without making changes:

```bash
npm run stripe:reset
```

The preview and final summary payloads also include the configured API version so you can confirm the reset is running against the expected Stripe contract.

Apply the destructive reset against the configured test account and recreate the canonical catalog:

```bash
ALLOW_STRIPE_RESET=true npm run stripe:reset -- --apply --reseed-catalog
```

## Safety rules

- `stripe:reset` refuses to run with a non-test Stripe key.
- `stripe:reset --apply` also requires `ALLOW_STRIPE_RESET=true`.
- The reset script cancels or archives objects where Stripe does not allow hard deletion.

## Local webhook forwarding

Forward Stripe events to the local app and capture a fresh webhook secret:

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Set the returned signing secret as `STRIPE_WEBHOOK_SECRET`.

## Notes

- `scripts/stripe_demo.py` is a legacy API demo that intentionally creates test objects. It is not part of the Maple Rental checkout setup.
- If you need a truly pristine Stripe environment, prefer a fresh Stripe sandbox in the Dashboard instead of reusing a polluted long-lived test account.
