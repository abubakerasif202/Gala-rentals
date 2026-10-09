# GalaRentals Vercel Deployment

Project: `abubakerasif202s-projects/galarentals`; repository: `abubakerasif202/Gala-rentals`; canonical domain: `https://www.galarentals.com.au`.

The application uses Vite assets on the CDN and one Node 22 Express function in `syd1`. `vercel.json` explicitly selects the package builder; `npm run vercel-build` emits Build Output API v3. No persistent listener runs inside the function. Local development remains `npm run dev`.

## Preview release

```powershell
npm run lint
npm run test
npm run validate
npm run build
npm run vercel:build
vercel deploy --prebuilt --target preview --scope abubakerasif202s-projects
```

Verify the project link before deploying. Keep preview protection enabled and writes disabled until isolated Supabase, Stripe test-mode and email configuration are verified. Use only GalaRentals credentials, store server secrets in the appropriate Vercel environment, and keep private environment files out of Git.

## Production gate

The current [readiness report](docs/VERCEL_PRODUCTION_READINESS.md) records unresolved staging and integration requirements. Production DDL, deployment, DNS and live payment endpoint changes require explicit approval. Preserve existing customers, subscriptions and payment-only completion behavior.

See [environment configuration](docs/VERCEL_ENVIRONMENT.md), [deployment procedures](docs/VERCEL_MIGRATION.md), and [Stripe setup](docs/STRIPE_SETUP.md). Workbook operations run on the authorized Windows workstation; Vercel functions do not run a persistent worker.

## Monitoring and rollback

Verify both `/api/live` and dependency-aware `/api/health`, public asset hashes, private document access and webhook delivery. After an approved Production release, rollback can use the last validated Vercel deployment. Never roll back customer data, recreate subscriptions or replay successful payments indiscriminately. Retain the shared webhook ledger and reconcile in-flight events.
