# Gala Rentals Deployment Handoff

Gala Rentals must be deployed as its own rental company project with its own repository, Render service, Supabase project, Stripe account resources, webhook endpoint, and environment variables.

## Production Identity

- Brand: Gala Rentals
- Domain: `https://www.galarentals.com.au`
- Email: `hello@gala-rentals.com.au`
- Render service: `gala-rentals`
- Repository: `https://github.com/abubakerasif202/gala-rentals.git`
- Stripe webhook: `https://www.galarentals.com.au/api/stripe/webhook`

## Deployment Rules

- Use only Gala-specific Supabase credentials.
- Use only Gala-specific Stripe products, prices, keys, and webhook secrets.
- Keep `render.yaml` on branch `main`.
- Keep the build command as `npm ci --include=dev && npm run validate && npm run build`.
- Keep the start command as `npm start`.
- Keep the health check path as `/api/health`.
- Do not add real secrets to the repository.

## Required Render Variables

The blueprint defines the required keys. Fill the synced values in Render:

- `APP_URL=https://www.galarentals.com.au`
- `ADMIN_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SUPABASE_DB_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_LINK_SECRET`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Static values are already in `render.yaml`:

- `NODE_ENV=production`
- `VITE_API_BASE_URL=/api`
- `VITE_SUPABASE_VEHICLE_IMAGES_BUCKET=vehicle-images`
- `LEASE_OWNER_NAME=Gala Rentals`
- `LEASE_OWNER_ADDRESS=Sydney NSW`
- `LEASE_OWNER_CONTACT=1300 555 828`
- `LEASE_OWNER_EMAIL=hello@gala-rentals.com.au`

## Smoke Tests

After deployment, verify:

```powershell
curl.exe https://www.galarentals.com.au/api/live
curl.exe https://www.galarentals.com.au/api/health
curl.exe https://www.galarentals.com.au/
curl.exe https://www.galarentals.com.au/apply
```

Do not call the deployment complete until health, liveness, homepage, and application page checks pass against the intended deployed commit.
