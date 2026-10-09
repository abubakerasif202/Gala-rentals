# GalaRentals: Vercel deployment

## Status and safety gate

Current continuation results are in [VERCEL_PRODUCTION_READINESS.md](VERCEL_PRODUCTION_READINESS.md). The initial inactive-Supabase and dependency findings below are historical observations; the continuation verifies current state.

Production cutover is **NOT READY**. The preview must remain blocked for private data and writes until independently verified staging credentials are supplied. No database migration, customer-data change, Stripe destination update, production deployment, DNS change, or hosting changes is authorized by this implementation.

On 9 October 2026, the supplied private configuration matched the existing Supabase project named Gala-rentals. Supabase reported that project INACTIVE. Stripe and Resend values in the supplied file were placeholders. The production website and `/api/live` returned HTTP 503, with the latter reporting “Service Suspended.” These are pre-cutover observations, not changes made by the migration.

## Architecture before and after

Before: The standalone server runs `api/index.ts` compiled to `server-dist/api/index.js`, serving both Vite's `dist/` and Express APIs. `npm run start:worker` runs a PostgreSQL-backed queue poller. Supabase provides storage, authentication, REST access and direct PostgreSQL operations. Stripe and Resend are backend integrations.

After: Vite remains the frontend. `scripts/build-vercel.mjs` emits Build Output API v3: `static/` contains only client artifacts; `functions/gala.func/` contains one Express function, PDF assets and PDFKit's dependencies. The configuration explicitly allowlists a single supported `@vercel/static-build` builder for `package.json`, which consumes the generated Build Output API. This supported legacy build declaration is necessary because the first ordinary Vite deployment still discovered every internal `api/` module as a function. It prevents that unsafe automatic discovery; only generated output is deployed. Internal files in the source `api/` directory are never individually deployed as endpoints in the corrected configuration. `serverless/handler.ts` uses `createServerlessApp()` without binding an HTTP listener. Local startup continues through the original entry point. The same GalaRentals production Supabase project, records and Stripe subscriptions are retained at cutover.

Project: `abubakerasif202s-projects/galarentals`; GitHub: `abubakerasif202/Gala-rentals`; root `.`; project framework preset Vite; the explicit builder runs `npm run vercel-build` (which invokes `npm run build:vercel`) and uses lockfile installation; project settings also record `npm ci --include=dev`; output `.vercel/output`; Node 22 LTS; function region `syd1`; function duration 60 seconds; streaming enabled. Memory uses Vercel's standard project allocation, rather than a legacy per-function override. The explicit builder takes precedence over the dashboard build/development settings, as Vercel warns during builds. Preview protection was verified as `all_except_custom_domains`. Automatic `main` deployments are disabled in the checked-in configuration until cutover approval; do not enable automatic production builds during preparation.

The first CLI deployment used `--target preview`, but Vercel automatically assigned the new project's first deployment to its production slot and `galarentals.vercel.app`. It has no application credentials and is protected. This did not move `www.galarentals.com.au` or activate payments. It also discovered internal API modules and is not the validated migration artifact. Subsequent corrected deployments use `--target preview`. The CLI permits `--skip-domain` only for production deployments, so it cannot be combined with preview. Never describe that initial protected shell as a completed production migration.

## Routes and browser behavior

`/api` and all `/api/*` requests reach Express before static/SPA routing. Existing auth, cars/vehicles, applications, inquiries, Stripe, rentals, admin agreements, agreements, toll notices, financials, customers, invoices, manual invoices, maintenance, health, liveness, stats and rental-plan routes retain their paths. `/admin/test-indexnow` and the existing IndexNow verification key route also reach Express.

Only existing frontend routes receive an HTML fallback, on GET/HEAD. Static assets are resolved first; missing assets/private paths return 404. Nested checkout and admin routes can load directly. API responses use `private, no-store`; fingerprinted assets use immutable caching. Static responses carry CSP, HSTS, frame and MIME protections. Existing backend Helmet, admin session cookies, origin checks, CORS and Zod validation remain in place. The exact Vercel preview deployment origin is accepted, without trusting wildcard preview hosts.

## Uploads and documents

Vercel limits request/response bodies to 4.5 MB. Existing files exceed that limit, so the application form now obtains `/api/applications/upload-intent`, uploads file bytes directly to signed Supabase URLs, and posts only form fields plus `upload_manifest` to the original submission endpoint. Files are staged under random paths in the configured **private** `SUPABASE_UPLOAD_STAGING_BUCKET`, defaulting to `applications`. The existing applications bucket caps files at 10 MB; a separate private bucket with a 15 MB limit is required to preserve the vehicle upload limit. The server checks bucket privacy, MIME permissions and size limits before issuing URLs. A purpose-bound HMAC manifest expires in 30 minutes. The backend bounds streaming downloads, verifies byte counts, and runs the original MIME/magic-byte and business validation before saving final documents. No public insert/storage policy is added. `/tmp` is transient scratch space only, never document retention storage.

Vehicle API clients can obtain `/api/cars/image/upload-intent` (or `/api/vehicles/image/upload-intent`) after admin authentication, then submit `upload_manifest` to the existing `/image` route. Use `prepareDirectUploads(formData, '/cars/image/upload-intent')` from the frontend helper. Existing multipart requests remain supported locally; Vercel clients must use the direct path for large files. Application file limits remain 7 MB/file and 22 MB total; vehicle images remain 15 MB. Stage cleanup failures leave private orphans. The operator retention script now also considers expired `staging/<uuid>/<field>` paths in the separate private bucket; it retains recent/unknown timestamps and unrelated document paths. Its existing apply confirmation remains required.

Verify `applications.public=false`, storage limits and upload CORS in staging before enabling submissions. Supabase signed upload tokens have their own expiry; the backend manifest has a shorter acceptance period. Abandoned/replayed staging objects must remain private until the existing cleanup removes them. Agreement and notice PDFs retain original generators; the function package includes the original toll PDF template and PDFKit fonts. Large PDF output must stream or use protected Storage URLs, not exceed Vercel's response limit.

## Database and shared security limits

Keep the current database. Do not replay historical schema/reset migrations or seed/import customer data. Use the existing session-capable Supabase connection required by current readiness checks. A module-level pool is reused per function instance, bounded to two clients. On Vercel, managed Supabase connections require `POSTGRES_SSL_CA`, verify the server certificate, and remove SSL URL parameters that could override verification. Standalone server behavior remains unchanged. This does not impose a fleet-wide connection cap: validate Supabase pooler capacity and load before cutover.

The new additive migration `20261009090000_add_serverless_rate_limits.sql` creates only private rate-limit counters, with RLS enabled and no anon/authenticated access. Login, inquiries, applications and API limits share atomic PostgreSQL counters across instances; keys hash IP/email identifiers. Store failure fails closed. Apply the single migration to **verified staging first**; production DDL requires explicit authorization. Readiness and health must pass against the exact schema before traffic changes. Leave the counter table in place during rollback; it is harmless to the standalone server. Drop it only after reverting functions and confirming no consumers.

## Preview configuration

See `.env.example` and [the environment inventory](VERCEL_ENVIRONMENT.md). `VITE_` values are public; service-role, database, JWT, checkout signing, Stripe signing and Resend credentials are server-only. `.env*` and tool/private directories are excluded from source uploads; function secrets come from Vercel environment settings, never bundled source.

Development uses GalaRentals local/test configuration. Preview requires an independently verified isolated GalaRentals Supabase target, real `sk_test_` Stripe credentials and the test webhook secret. Set `GALA_STAGING_SUPABASE_URL` equal to the verified staging `SUPABASE_URL`, `GALA_PREVIEW_EMAIL_TO` to a controlled test inbox, `INDEXNOW_ENABLED=false`, and `GALA_CRON_ENABLED=false`. Set `APP_URL` to the intended stable protected preview alias and use the exact deployment hostname for callback tests. Only then set `GALA_PREVIEW_WRITES_ENABLED=true`. Merely copying the production URL into a staging marker does not establish isolation.

All preview email recipients are replaced by the controlled inbox. Without that inbox, delivery fails safely. Preview rejects live Stripe keys and blocks both private reads and mutations by default. `/api/live` remains available; `/api/health` honestly returns 503 when dependencies are absent. Deployment READY does not mean application health READY.

Required server variables: `APP_URL`, `ADMIN_EMAIL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, session-capable `DATABASE_URL` or `SUPABASE_DB_URL`, `JWT_SECRET`, `CHECKOUT_LINK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Configure `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` for notifications. JWT and checkout signing secrets must be long random values. Production must reuse existing checkout/JWT signing secrets where outstanding links/sessions require compatibility.

## Stripe continuity

The original `/api/stripe/webhook` retains raw-body parsing **before** JSON middleware. No Vercel body helper parses the request. Signature verification, payload hashes, PostgreSQL locks, webhook event ledger, retry states, Checkout idempotency and subscription synchronization remain unchanged. The approved vehicle remains text only; checkout tokens retain `carId: null`; checkout completion marks `Paid` without creating rental records or mutating car status.

Test the protected preview with Stripe test-mode events through an authenticated proxy/CLI request; Stripe cannot deliver normally through Vercel SSO. Do not disable preview protection just for Stripe delivery. A persistent protected test tunnel or controlled signing/replay harness can forward exact bytes using a short-lived access token. Never forward live events into staging. Test Checkout, weekly subscription dates, success/cancel callbacks, duplicate events, failed invoices and subscription changes before declaring payment readiness.

At production cutover, keep the current webhook destination working until the replacement is validated. If the Stripe URL already uses `www.galarentals.com.au`, DNS migration moves that same endpoint and its existing signing secret can stay valid. A second Stripe destination gets a **different** signing secret: configure it correctly and control which destination processes events. Reuse the same ledger/database, verify cross-host duplicate delivery, and do not recreate customers or subscriptions. Keep one active background processor per logical queue.

## Background work and hosting limitations

The existing queue poller has an empty handler registry and no application routes currently enqueue PDF/email work. PDF/email operations run inside requests. Do not invent handlers, mark unknown jobs completed, or discard pending rows. Keep the external worker configuration available until actual queue contents and registered job types are verified.

When enabled at production build time, the output emits authenticated daily Cron `/api/cron/maintenance` removes at most 10,000 expired **rate-limit counters**, not customer records. UTC `0 17 * * *` is 03:00/04:00 Sydney depending on DST. Vercel cron runs only on production; it is disabled unless `GALA_CRON_ENABLED=true` and a valid `CRON_SECRET` bearer token is supplied. Replays are safe. Check the selected plan's cron/duration limits before enabling it.

Document retention remains the existing explicit `npm run clean:documents` dry-run/operator workflow; applying retention still requires its original confirmation token. No automatic destructive cleanup was enabled. Fleet workbook synchronization requires local Windows Excel/workbook files and PowerShell. Vercel cannot access that workstation or run that pipeline. The Vercel admin endpoint returns an explicit 503 with the authorized workstation command; `npm run cron:fleet-sync` remains intact. Retain a dedicated authorized Windows operator/worker for this function, with private GalaRentals credentials and the existing import safeguards. This is an unresolved external operational dependency, not a completed all-on-Vercel workflow. Do not decommission that operator path or external workers until its replacement and schedule are verified.

## Validation and preview deployment

From `C:\Users\abuba\Gala-rentals` in PowerShell:

```powershell
npm run lint
npm run test
npm run validate
npm run build
git status --short
git diff --stat
git diff --check
vercel project inspect --non-interactive
vercel pull --yes --environment=preview --scope abubakerasif202s-projects
npm run vercel:build
vercel deploy --prebuilt --target=preview --scope abubakerasif202s-projects
vercel inspect <preview-url> --scope abubakerasif202s-projects
vercel curl /api/live --deployment <preview-url>
vercel curl /api/health --deployment <preview-url>
```

Run dependency installs serially. Do not run `npm update` concurrently with `vercel build`, which invokes `npm ci`. An early local build found a mismatched esbuild binary; lockfile installation repaired that environment. The Windows Vercel CLI initially failed with `spawn cmd.exe ENOENT`: its plain environment object lost the system path when it contained `Path` and `PATH`. `npm run vercel:build` now normalizes the environment before launching the installed CLI and passes the actual local Vercel build. No global PATH or installed CLI code is patched. Remote Linux builds also pass. Keep source-map/private-file output inspection in the packaging script. Inspect both build logs and runtime logs. Verify deployed HTML/JS hashes against `.vercel/output/static`. Use authenticated browser contexts to test protected previews; never remove SSO protection to make tests pass.

## Production cutover checklist — approval required

1. Resolve inactive Supabase/staging access, secrets, dependency audit findings, external workbook worker and all blocked functional tests. Verify staging approvals/rejections, private uploads, agreements/notices, financial views, auth, CSRF/CORS, Stripe test events and duplicate replay.
2. Inventory existing DNS records and retain the last validated Vercel artifact for rollback. Keep mail MX/TXT/SPF/DKIM/DMARC records untouched.
3. After explicit authorization, apply only the new rate-limit migration to the verified existing production database. Configure Vercel Production with existing GalaRentals credentials and `APP_URL`, `SITE_URL`, `PUBLIC_SITE_URL=https://www.galarentals.com.au`. Verify private Storage/RLS and direct connection identity.
4. Create an approved production deployment without assigning the live domain first. Verify `/api/live`, dependency-aware `/api/health`, transactional payment mode, actual deployment assets and controlled admin smoke. Prepare Stripe delivery validation while retaining the current destination.
5. Add/inspect both `www.galarentals.com.au` and `galarentals.com.au` in Vercel. Use the **exact A/CNAME/TXT records supplied by that project's domain verification**, not generic remembered addresses. Confirm SSL provisioning. Set `www` canonical; apex returns 308 preserving path/query.
6. Update Supabase authentication allowlists and required integration callbacks for the approved canonical domain/preview aliases. Existing admin auth uses backend cookies and password sign-in; do not assume an OAuth redirect is used where none exists.
7. Obtain explicit DNS/live-payment authorization, then change only web-host records. Check both hosts, nested routes, API health, cookie security, Stripe webhook delivery and ledger status. Run no live customer-payment tests.
8. Monitor failed/retrying webhook events, payment review states, auth/upload/PDF failures, function timeouts, database connections and cron logs. Enable only one approved cron/worker owner; retain the validated Vercel deployment until stability is demonstrated.

## Vercel rollback

Rollback: after the first approved Production release, restore the last validated Vercel deployment and the original integration configuration. Preserve the shared ledger and all customer/subscription records. Reconcile events received during transition before replay; never resend successful payments or create replacement subscriptions. The additive counter migration can remain in place.


Official architecture references: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Build Output API configuration](https://vercel.com/docs/build-output-api/configuration), [Node function primitives](https://vercel.com/docs/build-output-api/primitives), [function limits](https://vercel.com/docs/functions/limitations), [supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
