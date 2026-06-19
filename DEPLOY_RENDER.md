# Deploy Gala Rentals to Render

## Goal

Deploy Gala Rentals as a single Render web service where Express serves the API under `/api/*`, serves the built Vite frontend from `dist/`, and exposes `/api/health` for Render health checks.

## Render Blueprint

This repository includes `render.yaml`.

Blueprint repo:
`https://github.com/abubakerasif202/gala-rentals.git`

Expected service configuration:

- Service name: `gala-rentals`
- Runtime: `Node`
- Branch: `main`
- Build command: `npm ci --include=dev && npm run validate && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Production URL: `https://www.gala-rentals.com.au`

## Required Environment Variables

Set these in the Gala Rentals Render service. Do not reuse credentials from any other rental brand.

- `NODE_ENV=production`
- `APP_URL=https://www.gala-rentals.com.au`
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
- `LEASE_OWNER_NAME=Gala Rentals`
- `LEASE_OWNER_ADDRESS=Sydney NSW`
- `LEASE_OWNER_CONTACT=1300 555 828`
- `LEASE_OWNER_EMAIL=hello@gala-rentals.com.au`

## Stripe Webhook

Configure Stripe to send production events to:

`https://www.gala-rentals.com.au/api/stripe/webhook`

Keep webhook signing verification enabled and store the signing secret in `STRIPE_WEBHOOK_SECRET`.

## First Deploy Checklist

1. Connect the Gala Rentals GitHub repository in Render.
2. Create or apply the Blueprint for the `gala-rentals` service.
3. Fill every required environment variable with Gala-specific values.
4. Connect the Gala database and set `DATABASE_URL`.
5. Configure a separate Gala Supabase project and storage buckets.
6. Configure separate Gala Stripe products, prices, and webhook endpoint.
7. Run the production build through Render.
8. Verify `https://www.gala-rentals.com.au/api/live`.
9. Verify `https://www.gala-rentals.com.au/api/health`.
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
