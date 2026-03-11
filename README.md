<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Maple Rental

Maple Rental is a full-stack rental operations app for a hybrid vehicle fleet. The public site lets drivers browse vehicles, compare plans, submit an application with driver licence front and back photos, and continue into Stripe checkout. The admin side handles application review, fleet management, rentals, lease agreements, operational customer and invoice records, and weekly financial reporting.

## What the app includes

- Public marketing site with pricing, fleet pages, and inquiry flow
- Driver application flow with document upload and Stripe checkout handoff
- Admin login backed by Supabase Auth
- Admin dashboard for applications, rentals, customers, invoices, agreements, and financial summaries
- Supabase Postgres for primary data storage
- Supabase Storage for private application documents
- Stripe checkout and webhook processing
- Render-ready production deployment via a single web service

## Stack

- Frontend: React 19, Vite, React Router, TanStack Query, Tailwind CSS
- Backend: Express, TypeScript, Supabase client, Stripe SDK, Resend
- Data: Supabase Postgres + Supabase Storage
- Deployment: Render

## Route overview

### Public routes

- `/` home page
- `/pricing` rental plans
- `/cars` fleet listing
- `/cars/:id` vehicle details
- `/apply` driver application
- `/checkout/:id` vehicle checkout
- `/success` checkout completion

### Admin routes

- `/admin/login` admin sign-in
- `/admin/dashboard` protected admin workspace

### API routes

- `/api/auth`
- `/api/cars`
- `/api/applications`
- `/api/stripe`
- `/api/rentals`
- `/api/agreements`
- `/api/financials`
- `/api/customers`
- `/api/invoices`
- `/api/health`

## Local development

### Prerequisites

- Node.js 20.x
- A Supabase project
- A Stripe account for checkout and webhooks

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values.
The backend and helper scripts load `.env` first and then `.env.local` during local development, so `.env.local` works for both Vite and Node flows.

```env
# Backend
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DB_URL=your_direct_postgres_connection_string
ADMIN_EMAIL=admin@maplerentals.com.au
APP_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CHECKOUT_LINK_SECRET=replace_with_a_long_random_secret
RESEND_API_KEY=re_...

# Frontend
VITE_API_BASE_URL=/api

# Optional
# FRONTEND_URL=http://localhost:5173
# CORS_ORIGIN=http://localhost:5173
```

### 3. Create the database schema

Run the helper below to print the SQL you need to paste into the Supabase SQL Editor:

```bash
node scripts/seed-schema.js
```

That script does not apply migrations automatically. It prints the contents of `supabase-schema.sql` and tells you where to run it in Supabase.

If you are upgrading an existing environment, apply the active vehicle allocation index as well:

```bash
npm run migrate:vehicle-allocation
```

### 4. Create the private document bucket

The application uploads driver documents into a private Supabase Storage bucket named `applications`.

```bash
npx tsx scripts/setup-bucket.ts
```

### 5. Create the admin account

Create the whitelisted admin user in Supabase Auth and mirror it into the `admins` table:

```bash
node scripts/seed-admin.js admin@maplerentals.com.au your-password
```

To reset the password later:

```bash
node scripts/reset-admin.js admin@maplerentals.com.au new-password
```

### 6. Start the app

```bash
npm run dev
```

In development, the Express API runs with Vite middleware on the same server. By default the app is available at `http://localhost:5173`.

## Production build and run

Build the client and server:

```bash
npm run build
```

Start the compiled production server:

```bash
npm start
```

The production server serves the built frontend from `dist/` and exposes the API from the same process.

## Useful scripts

- `npm run dev` start the local full-stack development server
- `npm run build` build client and server for production
- `npm start` run the compiled production server from `server-dist/`
- `npm run lint` run TypeScript type-checking
- `npm run test` run the Vitest suite
- `npm run clean` remove build output, generated review artifacts, and local server logs
- `npm run migrate:vehicle-allocation` apply the active vehicle allocation index to an existing database
- `npm run migrate:operational-history` run the operational history migration helper

## Deployment

This repo includes `render.yaml` for a single Render web service deployment.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

Required Render environment variables:

- `APP_URL`
- `ADMIN_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_LINK_SECRET`

If transactional email is enabled, also provide:

- `RESEND_API_KEY`

## Operational notes

- Admin access is restricted to the single email in `ADMIN_EMAIL`.
- Driver licence uploads are stored in the private `applications` storage bucket and accessed via short-lived signed URLs.
- In production, the server fails fast if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.
- `SUPABASE_DB_URL` is only needed by certain scripts, not by the runtime app itself.
- `scripts/pg-seed.js` is destructive and requires `ALLOW_SCHEMA_RESET=true`.

## Verification checklist

After setup, verify the basics:

1. Open `/` and confirm the public site loads.
2. Submit a test application on `/apply`.
3. Confirm an admin can log in at `/admin/login`.
4. Confirm the new application appears in `/admin/dashboard`.
5. Confirm `/api/health` returns `{"status":"ok"}`.

## Repository notes

- Do not commit raw customer, invoice, or operational exports.
- Keep temporary imports and scrape artifacts in local untracked paths only.
