# Deploy Galarentals to Render

## Goal

Deploy Galarentals as a single Render web service where Express serves the API under `/api/*`, serves the built Vite frontend from `dist/`, and exposes `/api/health` for Render health checks.

## Render Blueprint

This repository includes `render.yaml`.

Blueprint repo:
`https://github.com/abubakerasif202/galarentals.git`

Expected service configuration:

- Service name: `galarentals`
- Runtime: `Node`
- Branch: `main`
- Build command: `npm ci --include=dev && npm run validate && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Production URL: `https://www.galarentals.com.au`

## Required Environment Variables

Set these in the Galarentals Render service. Do not reuse credentials from any other rental brand.

- `NODE_ENV=production`
- `APP_URL=https://www.galarentals.com.au`
- `ADMIN_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SUPABASE_DB_URL` only as a fallback when `DATABASE_URL` is unavailable
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_LINK_SECRET`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `VITE_API_BASE_URL=/api`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_VEHICLE_IMAGES_BUCKET=vehicle-images`
- `LEASE_OWNER_NAME=Sarfraz Ahmad`
- `LEASE_OWNER_ADDRESS=24 Kinghorne St, Gledswood Hills NSW 2557`
- `LEASE_OWNER_CONTACT=+61415228557`
- `LEASE_OWNER_EMAIL=admin@galarentals.com.au`

## Stripe Webhook

Configure Stripe to send production events to:

`https://www.galarentals.com.au/api/stripe/webhook`

Keep webhook signing verification enabled and store the signing secret in `STRIPE_WEBHOOK_SECRET`.

## First Deploy Checklist

1. Connect the Galarentals GitHub repository in Render.
2. Create or apply the Blueprint for the `galarentals` service.
3. Fill every required environment variable with Gala-specific values.
4. Connect the Gala database and set `DATABASE_URL`.
5. Configure a separate Gala Supabase project and storage buckets.
6. Configure separate Gala Stripe products, prices, and webhook endpoint.
7. Run the production build through Render.
8. Verify `https://www.galarentals.com.au/api/live`.
9. Verify `https://www.galarentals.com.au/api/health`.
10. Verify the public homepage and `/apply` load from the deployed asset hash.

## Local Production Verification

```powershell
npm ci
npm run validate
npm run build
$env:NODE_ENV='production'
$env:PORT='3000'
npm start
```

Then check:

- `http://localhost:3000/api/health`
- `http://localhost:3000/`
- `http://localhost:3000/apply`

## Notes

- Do not set `PORT` manually on Render.
- Do not expose service-role, Stripe, database, Resend, or JWT secrets to the frontend.
- `DATABASE_URL` should be a session-capable Postgres connection for transactional payment activation.
- If `paymentActivationMode` is `restricted`, the app is running but the direct database connection is missing or unsuitable.
