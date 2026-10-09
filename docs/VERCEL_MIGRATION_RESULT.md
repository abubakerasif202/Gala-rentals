> Initial migration snapshot. See [VERCEL_PRODUCTION_READINESS.md](VERCEL_PRODUCTION_READINESS.md) for the current continuation: Supabase is active, audit findings are resolved, Windows builds are fixed, and available Production configuration has been added. Integration/cutover gates remain explicit.

# GalaRentals migration result — 9 October 2026

**Protected preview deployed; production cutover NOT READY.**

Final preview: https://galarentals-kh0yw9f8c-abubakerasif202s-projects.vercel.app

Vercel project: `abubakerasif202s-projects/galarentals`; deployment `dpl_J6486j9NCFuLv9MHLrNaXNwWv9gM`. The final deployment uses the validated prebuilt artifact. A separate corrected remote Linux source build also passed at https://galarentals-e1rxrp2ne-abubakerasif202s-projects.vercel.app. Platform metadata reports preview (target null), READY, one function, region `syd1`. Preview authentication remains enabled.

The live domain remains on its existing hosting route. No DNS changes, production secrets, live Stripe endpoint activation, database migration, or hosting cancellation were performed. The live site currently returns HTTP 503; `/api/live` reports “Service Suspended.” Supabase reports the existing named GalaRentals project INACTIVE. The user explicitly selected keeping the preview blocked until staging credentials are supplied.

The first deployment was automatically assigned to Vercel's production slot despite the CLI's preview target. That protected, credential-free shell remains at `galarentals.vercel.app`; it is not a live GalaRentals cutover and is not the validated single-function artifact. This platform behavior is recorded rather than presented as an authorized production release.

## Architecture and configuration

Before: persistent Express server serves APIs and Vite assets, with a separate queue worker and Windows/operator scripts. After: Vite assets on the Vercel CDN and one Node 22 Express function, using the existing Supabase/Stripe architecture. Application initialization and local listener startup are separated for serverless use. Existing payment-only completion is preserved.

Project preset Vite; root `.`; GitHub connected to `abubakerasif202/Gala-rentals`. The explicit `@vercel/static-build` allowlist runs `npm run vercel-build`, then `npm run build:vercel`, and consumes Build Output API v3. This prevents automatic publication of internal `api/` modules. Dashboard build/development settings are overridden by this supported legacy builder declaration. Output `.vercel/output`; function Node 22, `syd1`, 60 seconds, response streaming; memory uses the platform default. The local private function package is approximately 26 MB. No source maps or private source files are published as static files. Main-branch automatic deployment is disabled in configuration.

## Exact validation results

| Command/check | Final result |
| --- | --- |
| `npm ci --include=dev` | PASS; repaired initial esbuild binary/version mismatch |
| `npm update proxy-addr multer axios` | PASS on serial retry; versions 2.0.8 / 2.4.0 / 1.20.0 respectively |
| `npm run lint` | PASS, exit 0 |
| `npm run test` | PASS, exit 0; 503 tests across 52 files |
| `npm run validate` | PASS, exit 0; migration safety check and all 503 tests passed |
| `npm run build` | PASS, exit 0; client and server builds |
| `npm run build:vercel` | PASS, exit 0; single-function packaging and public-artifact checks |
| Local Windows `vercel build` | FAIL; `spawn cmd.exe ENOENT` after dependency install; not claimed as passed |
| Remote Vercel `vercel build` | PASS; corrected explicit-builder source deployment READY |
| `vercel deploy --prebuilt --target preview` | PASS; final deployment READY |
| `git status --short` | Ran; extensive pre-existing dirty worktree preserved |
| `git diff --stat` | Ran; includes existing changes, not an attribution of all changes to this task |
| `git diff --check` | FAIL on existing CRLF/whitespace in the dirty tree |
| CRLF-aware whole-tree diff check | FAIL only on existing `CLAUDE.md` lines 11–12 |
| CRLF-aware check of migration-touched tracked files | PASS |
| `npm audit --json` | FAIL as a readiness gate: 13 findings remain, 7 high and 6 moderate; zero critical |
| Local `npm run dev`, dedicated port 4317 | PASS: `/api/live` 200, direct `/admin/login` 200; task-owned processes stopped afterward |

Initial failures were retained as evidence: an overlapped dependency update/local Vercel reinstall caused a local file conflict; serial lockfile installation and targeted updates resolved it. The historical migration hash checker initially failed because two unchanged SQL files had CRLF endings. Both matched Git HEAD and the existing baseline after LF normalization. The checker now normalizes CRLF only; baseline hashes and SQL files were not changed or weakened.

## Browser, routing and security smoke

Authenticated Chrome/Playwright tests against the **final** preview:

- Desktop 1440×900: `/`, `/pricing`, `/faq`, `/contact`, `/apply`, `/admin/login`, `/admin/dashboard`, and direct `/checkout/gala-staging-fixture` returned 200. Checkout showed its invalid-link state; this was not a payment test.
- Mobile 390×844: `/`, `/pricing`, `/apply`, `/admin/login` returned 200 with no horizontal overflow. Desktop routes also had no overflow. No uncaught browser JavaScript errors were observed.
- `/api/live`: 200 JSON, no-store. Its `environment: production` field describes Node's `NODE_ENV`; this is a preview deployment, not a live cutover.
- `/api/health`: expected 503 JSON, no-store, database unavailable/direct database not configured/payment mode restricted.
- `/api/applications`, POST `/api/stripe/webhook`, and `/api/db/postgres`: expected guarded 503 JSON. The single function enforces preview isolation; utility source modules are not independent endpoints.
- `/.env`, `/server-dist/api/index.js`, and `/assets/missing.js`: 404, with no SPA fallback leakage.
- Final deployed `/assets/index-BB0kTXPS.js` and `/assets/index-Bn6tuXmh.css`: 200; SHA-256 bytes exactly matched local build artifacts.

The remote Linux build produced different frontend hashes than Windows. The final prebuilt deployment was used to establish an exact byte-for-byte match with the validated local artifacts. Do not confuse the two deployment URLs.

## Supabase, Stripe and remaining blockers

The private configuration file matched the existing named GalaRentals project, not another project. Only read-only infrastructure identity/status inspection was performed. No credentials from that file were copied into Vercel and no application records, active rentals, subscriptions, documents or financial data were modified.

Supabase RLS, storage permissions, real document transfers, production schema health, admin login/approval/rejection, agreements/notices, financial dashboards and driver workflows are **BLOCKED / NOT TESTED against staging**. Local regression tests passed; they are not evidence of live integration success.

Stripe Checkout, real test subscriptions, valid signed webhook delivery/replay, failed invoices and subscription updates are **BLOCKED / NOT TESTED against preview integrations**. The supplied Stripe/webhook and Resend values are placeholders. Existing raw-body handling, locks, ledger/idempotency and payment-only rules were preserved and covered by the local suite; no Stripe resources or endpoints were changed.

Application credentials absent from Vercel, by name only:

`APP_URL`, `ADMIN_EMAIL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` or `SUPABASE_DB_URL`, `JWT_SECRET`, `CHECKOUT_LINK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`, `GALA_STAGING_SUPABASE_URL`, `GALA_PREVIEW_EMAIL_TO`.

Optional production cron configuration remains disabled and requires `CRON_SECRET` plus `GALA_CRON_ENABLED=true` at approved production build time. `GALA_PREVIEW_WRITES_ENABLED=false` is configured. Client-visible variables are documented separately; no private value belongs under `VITE_`.

The new rate-limit migration is **written but NOT APPLIED anywhere**. Actual cross-instance database counters, private staging uploads and retention integration still require staging validation. The remaining dependency findings are listed in the private audit output; no claim of a clean security audit is made.

Fleet workbook synchronization needs the existing authorized Windows operator/worker and local workbook files/PowerShell. The Vercel endpoint reports this limitation explicitly. The retention deletion workflow remains operator-confirmed, not automatically enabled. The existing queue worker has no registered handlers in source; verify real queue contents/operational configuration before retirement. These are unresolved operational dependencies for a full hosting migration.

Both GalaRentals custom domains are absent from the selected Vercel team. Exact Vercel DNS records therefore have not been obtained. Do not guess generic A/CNAME values or modify mail DNS. No validated Vercel Production rollback target exists yet.

## Files changed by this migration

This inventory describes this task's edits, not all 236 tracked files already appearing dirty in the checkout. New files are included even though `git diff --stat` omits untracked files.

| Files | Change |
| --- | --- |
| `vercel.json`, `.vercelignore`, `.gitignore` | Explicit Vercel builder/project routing boundary, Sydney region, automatic-main gate, private-file exclusions |
| `scripts/build-vercel.mjs`, `serverless/handler.ts` | Build Output API packaging, one function, PDF assets, static security/caching/SPA rules and artifact checks |
| `package.json`, `package-lock.json` | Node 22, Vercel build scripts and targeted security dependency updates |
| `tsconfig.json`, `tsconfig.server.json` | Exclude generated output from lint and include the serverless entry point in server compilation |
| `api/index.ts` | Serverless initialization/readiness, preview gates, no listener, routes and exact preview CORS origin |
| `api/db/postgres.ts` | Per-instance pool bound/idle behavior and serverless rate-table readiness |
| `api/middleware/distributedRateLimit.ts`, `api/middleware/distributedRateLimit.test.ts` | Shared PostgreSQL rate counters and isolation/error tests |
| `api/middleware/auth.ts`, `api/middleware/errors.ts` | Exact preview origin support and JSON handling for bare `/api` |
| `api/routes/auth.ts`, `api/routes/inquiries.ts` | Distributed rate-limit stores |
| `api/services/directUploads.ts`, `api/services/directUploads.test.ts` | Private signed uploads, manifest authorization, bounded downloads and validation tests |
| `api/routes/applications.ts`, `api/routes/cars.ts` | Direct-upload intents/hydration; retained original validation; explicit Windows sync limitation and awaited indexing |
| `src/lib/api.ts`, `src/lib/directUploads.test.ts` | Direct application upload client with success/failure tests |
| `api/email.ts` | Preview recipient isolation |
| `api/routes/cron.ts` | Authenticated, disabled-by-default, bounded/replay-safe counter housekeeping |
| `api/serverless.test.ts` | Liveness and preview live-payment/private-read guards |
| `supabase/migrations/20261009090000_add_serverless_rate_limits.sql` | Additive private counter table; no customer-data migration |
| `scripts/check-destructive-migrations.mjs` | Platform-independent CRLF hashing while retaining SQL-content checks |
| `.env.example` | Safe variable-name/configuration examples and preview/cron controls |
| `README.md`, `GALA_DEPLOYMENT.md` | Vercel deployment and readiness guidance |
| `docs/VERCEL_MIGRATION.md`, `docs/VERCEL_ENVIRONMENT.md`, `docs/VERCEL_API_ROUTES.md`, `docs/VERCEL_MIGRATION_RESULT.md` | Architecture, variable/route inventory, cutover, rollback, limitations and observed validation evidence |

No Git commit or push was performed. No pre-existing changes were reset/stashed/discarded. Existing dirty files were not staged wholesale.

## Cutover, rollback and decommission

The detailed approval-gated [cutover and rollback procedure](VERCEL_MIGRATION.md) is prepared. Resolve the inactive database/staging secrets, real integration tests, dependency findings and external workbook worker first. Apply only the new additive migration to verified staging, then seek explicit production DDL/DNS/live-payment authorization. Obtain project-specific DNS records and provision SSL for both domains; preserve mail records; keep one background owner; validate live APIs/assets and Stripe ledger behavior.

Rollback restores saved web DNS and original Stripe destination/signing-secret configuration without recreating subscriptions or altering customer data. Keep the validated deployment and shared ledger available until migration stability is proven. Verify the rollback deployment before relying on it. Decommission requires separate explicit authorization after all operational workflows and monitoring pass.
