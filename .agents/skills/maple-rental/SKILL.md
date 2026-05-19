---
name: maple-rental
description: Maple Rentals repo rules for payment links, admin workflow, Stripe, Supabase, and Render.
---

# Maple Rental

Use this skill when working in the Maple Rental repository, especially when touching admin workflows, payment links, Stripe Checkout, Stripe webhooks, Supabase, Render deployment, or production validation.

## Critical Payment Rule

Admin manually enters `Vehicle / Number Plate` as text only. Do not add car selection to payment approval, do not attach applications to cars during payment-link creation, and do not mutate car or rental state from payment checkout completion. Payment links must use `carId: null`; successful checkout should mark the application `Paid` only.

## Required Validation

For payment, admin, or backend changes, run:

```powershell
npm run lint
npm run test
npm run validate
npm run build
```

## Core Files

Inspect these before changing payment behavior:

- `api/routes/applications.ts`
- `api/routes/stripe.ts`
- `api/services/stripeCheckoutService.ts`
- `api/paymentActivation.ts`
- `api/services/stripeWebhookService.ts`
- `api/validation.ts`
- `src/lib/api.ts`
- `src/pages/AdminDashboard.tsx`
- `api/tests/api.test.ts`
- `api/validation.test.ts`
