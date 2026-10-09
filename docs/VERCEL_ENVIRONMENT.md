# GalaRentals environment inventory

Current continuation: available Production values are configured securely; Preview contains only the write-disable flag. See [VERCEL_PRODUCTION_READINESS.md](VERCEL_PRODUCTION_READINESS.md) for missing values and verified scope. Values never belong in reports.

`POSTGRES_SSL_CA` is server-only, certificate-verified TLS configuration. `SUPABASE_UPLOAD_STAGING_BUCKET` must name a private bucket whose limits support the intended uploads. `GALA_LOCAL_STAGING_DB_URL` is for the dedicated local test database only; never configure it in Vercel.

| Name | Boundary | Referenced by |
| --- | --- | --- |
| `ADMIN_EMAIL` | Server/operator only | `api/index.ts`, `api/middleware/auth.ts`, `scripts/reset-admin.js`, `scripts/seed-admin.js` |
| `ADMIN_PASSWORD` | Server/operator only | `api/routes/auth.ts`, `scripts/reset-admin.js`, `scripts/seed-admin.js` |
| `ALLOW_LEGACY_IMPORT` | Server/operator only | `scripts/pg-seed.js`, `scripts/seed-data.js`, `scripts/sync-realtime-fleet.js`, `scripts/workbook-operations.mjs` |
| `ALLOW_SCHEMA_RESET` | Server/operator only | `scripts/pg-seed.js` |
| `ALLOW_STRIPE_RESET` | Server/operator only | `scripts/stripe-reset.ts` |
| `ALLOW_SUBSCRIPTION_BACKFILL` | Server/operator only | `scripts/backfill-rental-subscription-ids.ts` |
| `APP_URL` | Server/operator only | `api/index.ts`, `api/middleware/auth.ts`, `api/paymentLinks.ts`, `api/services/indexNow.ts`, `scripts/stripe-setup.ts` |
| `BACKGROUND_JOB_LEASE_MS` | Server/operator only | `api/services/jobQueue.ts` |
| `BACKGROUND_JOB_POLL_INTERVAL_MS` | Server/operator only | `api/workers/backgroundWorker.ts` |
| `BACKGROUND_JOB_QUEUE` | Server/operator only | `api/workers/backgroundWorker.ts` |
| `CHECKOUT_LINK_SECRET` | Server/operator only | `api/checkoutTokens.ts`, `api/index.ts`, `api/services/directUploads.ts`, `scripts/stripe-setup.ts` |
| `CONTACT_FROM_EMAIL` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `CONTACT_TO_EMAIL` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `CORS_ORIGIN` | Server/operator only | `api/index.ts`, `api/middleware/auth.ts` |
| `CRON_SECRET` | Server/operator only | `api/routes/cron.ts` |
| `CSP_REPORTING` | Server/operator only | `api/index.ts` |
| `CSP_REPORT_URI` | Server/operator only | `api/index.ts` |
| `DATABASE_URL` | Server/operator only | `api/previewConfiguration.ts`, `scripts/backfill-rental-subscription-ids.ts`, `scripts/check-status.js`, `scripts/migrate-active-vehicle-allocation.js`, `scripts/migrate-application-indexes.js`, `scripts/migrate-legacy-snake-case-payment-workflow.js`, `scripts/migrate-operational-history.js`, `scripts/migrate-payment-workflow-upgrade.js`, `scripts/migrate-stripe-webhook-ledger.js`, `scripts/pg-seed.js`, `scripts/verify-rate-limits-staging.ts` |
| `DOCUMENT_PDF_QUEUE_NAME` | Server/operator only | `api/workers/backgroundWorker.ts` |
| `ESBUILD_BINARY_PATH` | Server/operator only | `scripts/ensureEsbuildBinaryPath.js` |
| `FRONTEND_URL` | Server/operator only | `api/index.ts`, `api/middleware/auth.ts`, `api/paymentLinks.ts` |
| `GALA_CRON_ENABLED` | Server/operator only | `api/previewConfiguration.ts`, `api/routes/cron.ts`, `scripts/build-vercel.mjs` |
| `GALA_FLEET_CLIENT_WORKBOOK_PATH` | Server/operator only | `scripts/fleet-sync-source.js` |
| `GALA_FLEET_INVOICE_WORKBOOK_PATH` | Server/operator only | `scripts/fleet-sync-source.js` |
| `GALA_FLEET_POWERSHELL_BIN` | Server/operator only | `scripts/sync-realtime-fleet.js` |
| `GALA_FLEET_SOURCE` | Server/operator only | `scripts/fleet-sync-source.js` |
| `GALA_FLEET_WORKBOOK_PATH` | Server/operator only | `scripts/fleet-sync-source.js` |
| `GALA_LOCAL_STAGING_DB_URL` | Server/operator only | `scripts/verify-rate-limits-staging.ts` |
| `GALA_PREVIEW_EMAIL_TO` | Server/operator only | `api/email.ts`, `api/previewConfiguration.ts` |
| `GALA_PREVIEW_WRITES_ENABLED` | Server/operator only | `api/index.ts` |
| `GALA_STAGING_SUPABASE_URL` | Server/operator only | `api/previewConfiguration.ts` |
| `INDEXNOW_DEBOUNCE_MS` | Server/operator only | `api/services/indexNow.ts` |
| `INDEXNOW_ENABLED` | Server/operator only | `api/previewConfiguration.ts`, `api/services/indexNow.ts` |
| `INDEXNOW_KEY` | Server/operator only | `api/services/indexNow.ts` |
| `INDEXNOW_TIMEOUT_MS` | Server/operator only | `api/services/indexNow.ts` |
| `JSON_BODY_LIMIT` | Server/operator only | `api/index.ts` |
| `JWT_SECRET` | Server/operator only | `api/middleware/auth.ts` |
| `LEASE_OWNER_ADDRESS` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `LEASE_OWNER_CONTACT` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `LEASE_OWNER_EMAIL` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `LEASE_OWNER_NAME` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `LEASE_RETURN_NOTICE_DAYS` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `LOAD_TEST_ALLOW_PRODUCTION` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_BASE_URL` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_CONCURRENCY` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_DURATION_SECONDS` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_MAX_ERROR_RATE` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_OUTPUT` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_P95_MS` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_P99_MS` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_PROFILE` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_RAMP_SECONDS` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_REQUEST_DELAY_MS` | Server/operator only | `scripts/load-test.mjs` |
| `LOAD_TEST_TIMEOUT_MS` | Server/operator only | `scripts/load-test.mjs` |
| `NODE_ENV` | Platform/test tooling | `api/adminMaintenanceReset.ts`, `api/db/index.ts`, `api/index.ts`, `api/middleware/auth.ts`, `api/paymentLinks.ts`, `api/routes/auth.ts`, `api/schemaContract.ts`, `scripts/load-env.js`, `scripts/stripe-setup.ts`, `scripts/verify-production-schema-contract.js` |
| `PORT` | Server/operator only | `api/index.ts` |
| `POSTGRES_SSL_CA` | Server/operator only | `api/db/postgres.ts` |
| `PUBLIC_SITE_URL` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `RESEND_API_KEY` | Server/operator only | `api/email.ts`, `api/paymentActivation.ts`, `api/paymentLinks.ts`, `api/previewConfiguration.ts`, `api/routes/applications.ts`, `api/routes/inquiries.ts`, `api/routes/tollNotices.ts` |
| `SITE_URL` | Server/operator only | `api/services/indexNow.ts` |
| `STRIPE_ONBOARDING_SETUP_PRODUCT_ID` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `STRIPE_SECRET_KEY` | Server/operator only | `api/previewConfiguration.ts`, `api/stripeClient.ts`, `scripts/stripe-setup.ts` |
| `STRIPE_SECURITY_BOND_PRODUCT_ID` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `STRIPE_WEBHOOK_SECRET` | Server/operator only | `api/index.ts`, `api/routes/webhooks.ts`, `scripts/stripe-setup.ts` |
| `STRIPE_WEEKLY_RENTAL_PRODUCT_ID` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `SUPABASE_ANON_KEY` | Server/operator only | Dynamic-key configuration / `.env.example` |
| `SUPABASE_DB_URL` | Server/operator only | `api/index.ts`, `api/previewConfiguration.ts`, `scripts/backfill-rental-subscription-ids.ts`, `scripts/check-status.js`, `scripts/migrate-active-vehicle-allocation.js`, `scripts/migrate-application-indexes.js`, `scripts/migrate-legacy-snake-case-payment-workflow.js`, `scripts/migrate-operational-history.js`, `scripts/migrate-payment-workflow-upgrade.js`, `scripts/migrate-stripe-webhook-ledger.js`, `scripts/pg-seed.js`, `scripts/verify-rate-limits-staging.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/operator only | `api/schemaCompat.ts`, `scripts/cleanup-orphaned-documents.ts`, `scripts/fleet-sync-utils.js`, `scripts/reset-admin.js`, `scripts/seed-admin.js`, `scripts/seed-data.js`, `scripts/seed-schema.js` |
| `SUPABASE_UPLOAD_STAGING_BUCKET` | Server/operator only | `api/services/directUploads.ts`, `scripts/cleanup-orphaned-documents.ts` |
| `SUPABASE_URL` | Server/operator only | `api/index.ts`, `api/previewConfiguration.ts`, `api/routes/cars.ts`, `api/schemaCompat.ts`, `scripts/cleanup-orphaned-documents.ts`, `scripts/fleet-sync-utils.js`, `scripts/reset-admin.js`, `scripts/seed-admin.js`, `scripts/seed-data.js`, `scripts/seed-schema.js`, `scripts/test-supabase.ts`, `scripts/workbook-operations.mjs` |
| `SUPABASE_VEHICLE_IMAGES_BUCKET` | Server/operator only | `api/routes/cars.ts`, `scripts/setup-bucket.ts` |
| `VERCEL` | Platform/test tooling | `api/db/postgres.ts`, `api/index.ts`, `api/middleware/distributedRateLimit.ts`, `api/routes/cars.ts`, `scripts/build-vercel.mjs`, `scripts/verify-rate-limits-staging.ts` |
| `VERCEL_ENV` | Platform/test tooling | `api/email.ts`, `api/index.ts`, `api/middleware/auth.ts`, `api/routes/cron.ts`, `scripts/build-vercel.mjs` |
| `VERCEL_URL` | Platform/test tooling | `api/index.ts`, `api/middleware/auth.ts` |
| `VITEST` | Platform/test tooling | `api/adminMaintenanceReset.ts`, `api/index.ts`, `api/middleware/auth.ts`, `api/middleware/requestLogger.ts`, `api/routes/applications.ts`, `api/routes/auth.ts`, `api/routes/inquiries.ts`, `api/schemaCompat.ts`, `scripts/verify-production-schema-contract.js` |
| `VITE_API_BASE_URL` | Public build-time | `src/lib/api.ts` |
| `VITE_STRIPE_PUBLIC_KEY` | Public build-time | Dynamic-key configuration / `.env.example` |
| `VITE_SUPABASE_ANON_KEY` | Public build-time | Dynamic-key configuration / `.env.example` |
| `VITE_SUPABASE_URL` | Public build-time | Dynamic-key configuration / `.env.example` |
| `VITE_SUPABASE_VEHICLE_IMAGES_BUCKET` | Public build-time | Dynamic-key configuration / `.env.example` |
