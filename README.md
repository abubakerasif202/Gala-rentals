# Galarentals

Galarentals is a full-stack subscription rental application platform for Sydney customers. The same Express process serves the API and the built React/Vite frontend in production.

## Production Identity

- Brand: Galarentals
- Domain: `https://www.galarentals.com.au`
- Contact: `hello@galarentals.com.au`
- Render service: `galarentals`
- Repository: `https://github.com/abubakerasif202/galarentals.git`
- Stripe webhook: `https://www.galarentals.com.au/api/stripe/webhook`

## Stack

- Frontend: React 19, Vite, React Router, TanStack Query, Tailwind CSS
- Backend: Express, TypeScript
- Data: Direct PostgreSQL for transactional state, Supabase Auth, Supabase Storage
- Payments: Stripe Checkout and Stripe webhooks
- Email: Resend
- Deployment: Render

## Runtime Architecture

- `npm run dev` starts the Express server through `tsx watch` and mounts Vite middleware in development.
- `npm run build` builds the Vite client into `dist/` and the server into `server-dist/`.
- `npm start` runs `node server-dist/api/index.js`.
- Express serves `/api/*` routes directly.
- Express serves built static assets from `dist/`.
- Non-API SPA routes fall back to `dist/index.html`.
- Health checks are exposed at `/api/health`.

## Local Development

```bash
npm ci
npm run dev
```

Local app:

- `http://localhost:3000`
- `http://localhost:3000/api/health`

## Environment Variables

Copy `.env.example` to `.env.local` and fill in Gala-specific values. Do not commit real secrets.

```env
APP_URL=http://localhost:3000
ADMIN_EMAIL=hello@galarentals.com.au
SUPABASE_URL=https://your-gala-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
DATABASE_URL=postgresql://...
SUPABASE_DB_URL=postgresql://...
CHECKOUT_LINK_SECRET=replace_with_a_long_random_secret
JWT_SECRET=replace_with_a_long_random_secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
VITE_API_BASE_URL=/api
VITE_SUPABASE_URL=https://your-gala-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_VEHICLE_IMAGES_BUCKET=vehicle-images
LEASE_OWNER_NAME=Galarentals
LEASE_OWNER_ADDRESS=Sydney NSW
LEASE_OWNER_CONTACT=1300 555 828
LEASE_OWNER_EMAIL=hello@galarentals.com.au
```

`DATABASE_URL` is preferred for transactional payment activation. `SUPABASE_DB_URL` remains a fallback for environments that have not moved to `DATABASE_URL`.

## Core Routes

Public:

- `/`
- `/pricing`
- `/apply`
- `/checkout/:id`
- `/success`
- `/faq`
- `/contact`

Legacy public fleet URLs:

- `/fleet`, `/fleet/:id`, `/cars`, `/cars/:id`, `/vehicles`, and `/vehicles/:id` redirect users into `/apply`.

Admin:

- `/admin/login`
- `/admin/dashboard`

API:

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
- `/api/live`

## Payment Workflow

Galarentals keeps application review, payment, and operational activation separate:

1. Customer submits an application.
2. Admin reviews the application and approves pricing/start date.
3. Backend creates a secure Stripe Checkout link.
4. Stripe confirms payment through the verified webhook route.
5. The app records payment state server-side.
6. Operational handover remains controlled by the admin workflow.

Do not trust frontend-provided price, status, Stripe IDs, or activation state.

## Validation

Run the repo-native checks before committing:

```bash
npm run lint
npm run test
npm run build
git diff --check
```

`npm run validate` runs lint and tests together.

## Render Deployment

Render is configured by `render.yaml`:

- Service name: `galarentals`
- Branch: `main`
- Build command: `npm ci --include=dev && npm run validate && npm run build`
- Start command: `npm start`
- Health path: `/api/health`

Deployment instructions are in [DEPLOY_RENDER.md](DEPLOY_RENDER.md).

## Production Smoke

After an approved Gala deployment, verify:

```powershell
curl.exe https://www.galarentals.com.au/api/live
curl.exe https://www.galarentals.com.au/api/health
curl.exe https://www.galarentals.com.au/
curl.exe https://www.galarentals.com.au/apply
```

Do not call deployment complete until the deployed commit and production health checks are verified.
