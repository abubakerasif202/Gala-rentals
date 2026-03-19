# Deploy Maple Rental to Render

## Goal

Deploy the application as a single Render web service where:

- Express serves the API under `/api/*`
- Express serves the built Vite frontend from `dist/`
- non-API routes fall back to `dist/index.html`
- Render health checks probe `/api/health`

## Render blueprint

This repository includes `render.yaml`, so Render can provision the service directly from GitHub.

Blueprint link:
[https://dashboard.render.com/blueprint/new?repo=https://github.com/abubakerasif202/maple-rental](https://dashboard.render.com/blueprint/new?repo=https://github.com/abubakerasif202/maple-rental)

Supabase SQL files are organized under `supabase/migrations/`, with the base schema in `supabase/migrations/01_schema.sql`.

## Expected service configuration

- Service type: `Web Service`
- Runtime: `Node`
- Build command: `npm ci --include=dev && npm run validate && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

## Runtime model

### Development

`npm run dev` starts the Express server in development mode and mounts Vite middleware inside the same process.

Default local URL:
- `http://localhost:3000`

### Production

`npm start` runs the compiled backend from:
- `server-dist/api/index.js`

That server:
- binds to `0.0.0.0:$PORT`
- serves static frontend assets from `dist/`
- returns `dist/index.html` for SPA routes
- keeps missing API routes as JSON 404s instead of returning the frontend shell

## Environment variables

### Required

- `APP_URL`
  - Canonical public app URL, for example `https://www.maplerentals.com.au`

- `ADMIN_EMAIL`
  - Allowed production admin login email

- `SUPABASE_URL`
  - Supabase project URL in `https://...supabase.co` format

- `SUPABASE_SERVICE_ROLE_KEY`
  - Backend service-role key used for privileged database access

- `SUPABASE_ANON_KEY`
  - Frontend/browser public anon key used by the client app

- `STRIPE_SECRET_KEY`
  - Stripe server SDK key

- `STRIPE_WEBHOOK_SECRET`
  - Stripe webhook signing secret

- `CHECKOUT_LINK_SECRET`
  - HMAC secret used to sign checkout link tokens

### Strongly recommended

- `SUPABASE_DB_URL`
  - Direct or pooled Postgres connection string used for transactional payment activation
  - If omitted, the app stays live but `/api/health` reports `paymentActivationMode: "best_effort"`

### Optional

- `RESEND_API_KEY`
  - Enables outbound transactional email

- `CORS_ORIGIN`
  - Additional browser origin to allow

- `FRONTEND_URL`
  - Legacy extra origin override if needed for external clients

- `ADMIN_PASSWORD`
  - Dev/test fallback only; not required in production

- `JSON_BODY_LIMIT`
  - Overrides the default JSON payload limit of `25mb`

## Important env rules

- `SUPABASE_URL` must be the HTTPS project URL, not the Postgres connection string.
- `SUPABASE_DB_URL` must be the Postgres connection string, not the HTTPS project URL.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- Do not set `PORT` manually on Render.

## First deploy checklist

1. Connect the GitHub repo in Render.
2. Use the Blueprint flow so `render.yaml` is applied.
3. Fill every required environment variable.
4. Add `SUPABASE_DB_URL` if you want transactional payment activation.
5. Deploy.
6. Verify [https://www.maplerentals.com.au/api/health](https://www.maplerentals.com.au/api/health) or your Render URL equivalent.

## Health check expectations

A healthy response should look like:

```json
{
  "status": "ok",
  "database": "ok",
  "paymentActivationMode": "transactional"
}
```

If `paymentActivationMode` is `best_effort`, the service is up but the direct Postgres connection is missing.

## Local production verification

Use this to simulate the Render runtime locally:

```powershell
npm ci
npm run build
$env:NODE_ENV='production'
$env:PORT='3000'
npm start
```

Then check:

- `http://localhost:3000/api/health`
- `http://localhost:3000/`
- `http://localhost:3000/admin/dashboard`

## Common failures

### Invalid supabaseUrl

Cause:
- a Postgres URI was pasted into `SUPABASE_URL`

Fix:
- put the `https://...supabase.co` URL back into `SUPABASE_URL`
- put the Postgres URI into `SUPABASE_DB_URL`

### Health endpoint shows `best_effort`

Cause:
- `SUPABASE_DB_URL` or `DATABASE_URL` is missing

Fix:
- add a valid Postgres connection string and redeploy

### Rate-limit proxy warning on Render

Cause:
- Express was not trusting the Render proxy

Fix:
- already handled in `api/index.ts` by enabling `trust proxy` in production

## Operational notes

- Static assets under `/assets/*` are served with long-lived cache headers.
- `index.html` is served with `Cache-Control: no-store` so SPA shells do not go stale.
- The backend validates critical production environment variables at startup and fails fast when required secrets are missing.
