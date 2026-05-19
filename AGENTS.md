# Maple Rental Agent Guide

## 1. Project Summary

Maple Rental is a production-style full-stack car rental application for handling customer applications, admin review, pricing approval, payment links, documents, operational records, and deployment health checks.

The frontend is a React + Vite admin/customer app. The backend is an Express + TypeScript API. Supabase provides Auth and Storage, while direct Postgres is used for transactional payment and rental operations that need stronger consistency. Stripe Checkout and subscriptions handle payments, Resend handles transactional email, and Render hosts the production service.

## 2. Tech Stack

- Frontend: React, Vite, TypeScript, TanStack Query, Tailwind-style utility classes.
- Backend: Express, TypeScript, Zod validation, REST API routes.
- Database: Supabase Postgres plus direct Postgres access for transactional flows.
- Auth and storage: Supabase Auth and Supabase Storage.
- Payments: Stripe Checkout, subscriptions, webhook processing, webhook ledger/idempotency.
- Email: Resend.
- Deployment: Render.
- Testing and validation: Vitest, TypeScript `tsc`, Vite production build.

## 3. Non-Negotiable Business Rules

- Admin manually enters `Vehicle / Number Plate` as plain text only.
- Do not add a car selector, dropdown, fleet picker, assigned car field, or `car_id` picker to payment approval.
- Do not send or forward `car_id` during payment-link creation.
- Payment links must be created with checkout token `carId: null`.
- Do not attach applications to cars when creating payment links.
- Do not mark cars as rented from checkout or payment completion.
- Do not create rental rows automatically from payment completion.
- Preserve the payment-only application completion path: successful checkout marks the application `Paid` only.
- Admin manages vehicle identity manually outside checkout and outside automatic fleet mutation.

## 4. Core Payment Flow

Pending application  
-> Admin enters `Vehicle / Number Plate` text, approved bond, and approved weekly price  
-> Admin sends or creates a payment link  
-> Payment link checkout token uses `carId: null`  
-> Customer pays through Stripe Checkout  
-> Successful checkout marks the application `Paid`  
-> No car status changes automatically  
-> No rental rows are created automatically

## 5. Files Future Agents Must Inspect Before Changing Payment Flow

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

## 6. Safety Rules for Changes

- Prefer the smallest production-safe patch that satisfies the requirement.
- Do not weaken authentication, admin authorization, webhook signature verification, schema checks, or payment idempotency.
- Do not remove tests to make a change pass.
- Do not expose Supabase service role keys, Stripe secrets, Resend keys, database URLs, or any other secrets.
- Do not add demo/imported data behavior into production flows.
- Preserve existing Stripe webhook ledger and idempotency behavior.
- Preserve schema compatibility checks unless the task explicitly requires a migration.
- Keep imported/demo fleet sync paths separate from live admin/payment paths.
- Confirm before guarded operations: force-push, hard reset, deleting files/directories, rotating secrets, triggering deploys, or irreversible database changes.

## 7. Testing Requirements

Every payment, admin, or backend change must run:

```powershell
npm run lint
npm run test
npm run validate
npm run build
```

## 8. Deployment Verification

After deploy, verify production health:

```powershell
curl.exe https://www.maplerentals.com.au/api/live
curl.exe https://www.maplerentals.com.au/api/health
```

Do not trigger a deployment without explicit user approval.

## 9. Similar Project Blueprint

Use this blueprint when building a similar production rental/payment app:

- Admin dashboard: authenticated admin area for applications, documents, financial state, operational history, and support actions.
- Application intake: customer-facing form with validation, clear submission state, and safe server-side normalization.
- Document upload: secure storage, file validation, signed access where needed, and no public secret exposure.
- Payment approval: admin sets text-only vehicle label, bond, weekly price, and sends a payment link.
- Stripe checkout: short-lived signed checkout token, hosted Stripe session creation, idempotency key, and no trusted client-side pricing.
- Webhook ledger: durable event ledger, duplicate handling, retry classification, idempotent fulfillment, and auditable status.
- Health endpoints: `/api/live` for liveness and `/api/health` for dependency-aware health.
- Schema validation: Zod request validation plus compatibility checks for production schema drift.
- Audit-safe maintenance reset: explicit admin confirmation, scoped deletion, preservation of live records, and clear failure payloads.
- Mobile-friendly admin UI: responsive controls, readable dense layouts, clear loading/error states, and no hidden destructive actions.

## 10. Agent Output Standard

Future agents must finish non-trivial work with:

- Changed files and what changed.
- Test results, including pass/fail for each command run.
- Risks or notable residual concerns.
- Manual follow-up, such as migrations, env vars, deploys, or secret rotation.
- Deployment checks, when a deploy was performed or requested.
