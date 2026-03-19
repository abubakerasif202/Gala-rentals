# Maple Rental

Maple Rental is a single-service full-stack rental platform for a hybrid vehicle fleet. The same Express process serves the API and the built React/Vite frontend in production.

## Executive Summary

- Public users can browse vehicles, submit applications, upload driver documents, and complete Stripe checkout.
- Admin users can review applications, manage cars, activate rentals, inspect customer and invoice history, and work with lease agreements.
- Supabase provides Postgres data storage, auth, and private document storage.
- Render deploys the app as one Node web service.

## Stack

- Frontend: React 19, Vite, React Router, TanStack Query, Tailwind CSS
- Backend: Express, TypeScript
- Data: Supabase Postgres and Supabase Storage
- Payments: Stripe
- Email: Resend
- Deployment: Render

## Runtime Architecture

### Development

- `npm run dev` starts the Express server through `tsx watch`.
- In development, Express mounts Vite in middleware mode.
- The full app runs from one local origin: `http://localhost:3000`.

### Production

- `npm run build` builds the Vite client into `dist/` and the server into `server-dist/`.
- `npm start` runs `node server-dist/api/index.js`.
- Express serves `/api/*` routes directly.
- Express serves built static assets from `dist/`.
- Non-API SPA routes fall back to `dist/index.html`.
- Health checks are exposed at `/api/health`.

## Routes

### Public

- `/`
- `/pricing`
- `/cars`
- `/cars/:id`
- `/apply`
- `/checkout/:id`
- `/success`

### Admin

- `/admin/login`
- `/admin/dashboard`

### API

- `/api/auth`
- `/api/cars`
- `/api/applications`
- `/api/inquiries`
- `/api/stripe`
- `/api/rentals`
- `/api/agreements`
- `/api/financials`
- `/api/customers`
- `/api/invoices`
- `/api/health`

## Local Development

### Prerequisites

- Node.js 20.x
- A Supabase project
- A Stripe account for checkout and webhooks

### Install

```bash
npm ci
```

### Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values.

The server loads `.env` first and then `.env.local` in non-production environments.

Minimum local variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
ADMIN_EMAIL=admin@maplerentals.com.au
CHECKOUT_LINK_SECRET=replace_with_a_long_random_secret
JWT_SECRET=replace_with_a_long_random_secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=http://localhost:3000
SITE_URL=http://localhost:3000
LEASE_OWNER_NAME=Maple Rentals Pty Ltd
LEASE_OWNER_ADDRESS=123 Fleet Street, Sydney NSW 2000, Australia
LEASE_OWNER_CONTACT=0420 550 556
LEASE_OWNER_EMAIL=hello@maplerentals.com.au
VITE_API_BASE_URL=/api
```

Recommended for full local parity:

```env
SUPABASE_DB_URL=postgresql://...
RESEND_API_KEY=re_...
```

Optional local-only admin shortcut:

```env
ADMIN_PASSWORD=change_me
```

If `ADMIN_PASSWORD` is set in development, the admin login route can issue a local signed admin session without requiring a live Supabase Auth sign-in.

### Prepare Supabase

Base schema and incremental SQL migrations live under `supabase/migrations/`.

Print the base schema SQL:

```bash
node scripts/seed-schema.js
```

Apply additional migrations for existing environments as needed:

```bash
npm run migrate:payment-workflow
npm run migrate:vehicle-allocation
npm run migrate:operational-history
```

Create the private storage bucket used for driver documents:

```bash
npx tsx scripts/setup-bucket.ts
```

Create or reset the admin user:

```bash
node scripts/seed-admin.js admin@maplerentals.com.au your-password
node scripts/reset-admin.js admin@maplerentals.com.au new-password
```

### Start development

```bash
npm run dev
```

Open:

- App: [http://localhost:3000](http://localhost:3000)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Build, Start, and Validate

```bash
npm run lint
npm run test
npm run validate
npm run build
npm start
```

What each command does:

- `npm run dev`: full-stack local development server
- `npm run lint`: TypeScript type-check
- `npm run test`: Vitest suite
- `npm run validate`: lint plus tests
- `npm run build`: client plus server production build
- `npm start`: compiled production server
- `npm run preview`: Vite preview for the static client bundle only

## Environment Variables

### Required in production

- `APP_URL`
  - Public application origin, for example `https://www.maplerentals.com.au`
- `ADMIN_EMAIL`
  - Single allowed admin email
- `SUPABASE_URL`
  - Must be the HTTPS project URL, not a Postgres URI
- `SUPABASE_ANON_KEY`
  - Required for auth-scoped Supabase operations such as admin sign-in and token verification
- `SUPABASE_SERVICE_ROLE_KEY`
  - Server-side privileged Supabase key
- `SUPABASE_DB_URL` or `DATABASE_URL`
  - Must be a session-capable Postgres connection on port `5432`; transaction-pooler URLs on port `6543` are not sufficient for production payment activation
- `CHECKOUT_LINK_SECRET`
  - Secret used to sign secure payment-link tokens
- `JWT_SECRET`
  - Secret used to sign admin session cookies
- `LEASE_OWNER_NAME`
- `LEASE_OWNER_ADDRESS`
- `LEASE_OWNER_CONTACT`
- `LEASE_OWNER_EMAIL`
  - Registered-owner details inserted into generated lease agreements
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Recommended in production

- `SUPABASE_DB_URL`
  - Direct or pooled Postgres connection string used for transactional Stripe activation writes
- `RESEND_API_KEY`
  - Transactional email delivery

### Optional

- `SITE_URL`
  - Canonical site URL for IndexNow publication. Falls back to `APP_URL`.
- `FRONTEND_URL`
  - Extra allowed browser origin
- `CORS_ORIGIN`
  - Extra allowed browser origin
- `JSON_BODY_LIMIT`
  - Override the global request body limit. Defaults to `100kb`.
- `/api/applications`
  - Uses a dedicated JSON parser sized for two 7 MB base64 licence uploads; this route is not controlled by `JSON_BODY_LIMIT`
- `INDEXNOW_ENABLED`
- `INDEXNOW_KEY`
- `INDEXNOW_TIMEOUT_MS`
- `INDEXNOW_DEBOUNCE_MS`

## Health Check

`GET /api/health` returns:

- `status`
- `environment`
- `database`
- `paymentActivationMode`

`paymentActivationMode` will be:

- `transactional` when `SUPABASE_DB_URL` or `DATABASE_URL` is configured
- `best_effort` when the app is running without a direct Postgres connection

## Security and Operational Notes

- Express trusts one proxy hop in production so rate limiting works correctly on Render.
- Helmet is enabled in production.
- Global API rate limiting is enabled, plus a stricter limiter on admin login attempts.
- API request bodies are size-limited.
- Admin auth cookies are `httpOnly`, `secure` in production, and `sameSite=strict`.
- Driver licence documents are stored in a private Supabase Storage bucket and served through short-lived signed URLs.
- The server fails fast in production on invalid or missing core config instead of constructing unsafe fallback clients.

## Render Deployment

This repo includes [`render.yaml`](./render.yaml) for a single web-service deployment.

Render runtime contract:

- Build command: `npm ci --include=dev && npm run validate && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

Recommended Render environment variables:

- `APP_URL`
- `ADMIN_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_LINK_SECRET`
- `JWT_SECRET`
- `LEASE_OWNER_NAME`
- `LEASE_OWNER_ADDRESS`
- `LEASE_OWNER_CONTACT`
- `LEASE_OWNER_EMAIL`
- `RESEND_API_KEY` if email delivery is enabled

## Troubleshooting

### `Invalid supabaseUrl`

`SUPABASE_URL` must be the HTTPS project URL, for example:

```env
SUPABASE_URL=https://your-project.supabase.co
```

Do not paste the Postgres connection string into `SUPABASE_URL`.

### Health endpoint reports `best_effort`

Add `SUPABASE_DB_URL` or `DATABASE_URL` to enable transactional Stripe payment activation.

### Admin login loops back to `/admin/login`

Check:

- `ADMIN_EMAIL`
- `SUPABASE_ANON_KEY`
- Supabase Auth user existence
- cookie settings on the deployed domain

### Render logs mention rate limiting and `X-Forwarded-For`

The server is already configured to trust Render’s proxy hop. If this appears again, confirm the service is running the latest commit from `main`.

## Repository Notes

- Do not commit real customer exports, invoice exports, or private documents.
- Keep destructive scripts gated behind explicit env checks.
- Treat `scripts/pg-seed.js` as destructive. It requires `ALLOW_SCHEMA_RESET=true`.
