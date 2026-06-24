# Stripe System V2

This document is historical only. Do not use it as the operational handoff for the current Gala Rentals payment flow.

The active reference is [`docs/stripe-system-v3.md`](./stripe-system-v3.md).

## Why This Is Deprecated

Stripe System V2 described an older car-linked checkout path where a verified payment could create rental rows and mutate car status automatically. That is not the current Gala Rentals contract.

The current payment flow is intentionally payment-only:

- Admin approval creates a secure Stripe Checkout subscription link for the application.
- Checkout metadata identifies the application, checkout kind, and payment-link version.
- `car_id` is intentionally omitted from new checkout metadata.
- The signed checkout token carries `carId: null`.
- Verified Stripe webhook completion marks the application `Paid`, stores Stripe identifiers, clears the pending checkout session, and writes the replay-safe fulfillment marker.
- Checkout completion does not create rental rows.
- Checkout completion does not change car status.
- Manual operational handover remains an admin workflow after payment.

## Current References

- Active Stripe architecture: [`docs/stripe-system-v3.md`](./stripe-system-v3.md)
- Stripe setup and QA: [`docs/STRIPE_SETUP.md`](./STRIPE_SETUP.md)
- Handoff checklist: [`docs/STRIPE_HANDOFF_CHECKLIST.md`](./STRIPE_HANDOFF_CHECKLIST.md)
- Agreement workflow: [`docs/LEASE_AGREEMENT_MANAGEMENT.md`](./LEASE_AGREEMENT_MANAGEMENT.md)

If a handover note, test, or operator runbook still says checkout completion should activate a rental or assign a car, treat that note as stale and update it before relying on it.
