# GalaRentals production readiness — 10 October 2026


Final protected preview: https://galarentals-go3nun8wr-abubakerasif202s-projects.vercel.app

Remote Linux source-build preview: https://galarentals-25psl7ek9-abubakerasif202s-projects.vercel.app

Final deployment `dpl_GV2JQPRZSCETaZ7Nuk56fmP5Smon` is READY with target null (Preview) and exactly one function in `syd1`. The final preview uses the validated local Build Output API artifact. The private function bundle SHA-256 is `57a53b587c266b86201f29f898aabea2f9082eb3e9da9105adec4365c1573829`. The source build separately proves the Linux pipeline. The project remains `abubakerasif202s-projects/galarentals`, connected to `abubakerasif202/Gala-rentals`. One Node 22 function runs in `syd1`; the supported explicit builder prevents internal API modules becoming endpoints. Automatic main-branch deployment remains disabled.

## Critical workflow results

| Priority / workflow | Status | Current-session evidence or exact blocker |
| --- | --- | --- |
| 1. Existing Supabase availability | PASS | Existing GalaRentals project `pdvvoentidzomdxxvzvk` reports ACTIVE_HEALTHY. No restore/recreation was performed. |
| Production credential identity and connectivity | PASS | Supplied service-role and anon keys returned HTTP 200 on a zero-row request against the correct project. Schema-contract verification passed. PostgreSQL was queried in READ ONLY transactions only. |
| Production TLS | PASS | The supplied `prod-ca-2021.crt` passed hostname/certificate verification with the actual adapter. Vercel now requires `POSTGRES_SSL_CA` and rejects missing verification configuration. SSL URL parameters cannot override the explicit CA/verification options. |
| Supabase RLS/storage metadata | PASS | Sensitive tables inspected have RLS enabled; anonymous application insert is revoked; private applications storage is not public; the service role has its expected bypass capability. This is metadata inspection, not a substitute for staging authorization tests. |
| 2. Available Production configuration | PASS | Twenty-one available values configured on the verified project, with private values sent through stdin and stored as Sensitive. Certificate included. No values printed or committed. |
| Complete Production configuration | BLOCKED | The existing `STRIPE_WEBHOOK_SECRET` is still required; live Checkout and notifications remain untested. Existing production signing/account configuration must be confirmed against the existing production configuration before cutover. |
| Isolated writable Preview configuration | BLOCKED | Preview contains only `GALA_PREVIEW_WRITES_ENABLED=false`. No separate Supabase staging URL/credentials/admin fixture or real Stripe test credentials were supplied. The only branch returned is the default main branch, with historical MIGRATIONS_FAILED metadata; it is not an isolated staging target. |
| 3. Dependency security | PASS | `npm audit --json`: zero vulnerabilities. Safe patch/minor updates resolved all thirteen findings without breaking framework upgrades or `--force`. Production-only audit also reports zero. |
| 4. Deployed authentication and admin business actions on staging | BLOCKED | No verified cloud staging database/admin account. Approval, rejection, private document access, financial views and operational writes were not tested against real staging integrations. Local regression tests passed. |
| Private upload implementation | PASS | Signed manifests bind bucket/scope/expiry; bucket privacy, size and MIME limits are checked before granting upload URLs; downloads are bounded. Tests cover target isolation and the actual 10 MB/15 MB mismatch. |
| Real signed upload/document round trip | BLOCKED | No isolated storage target. The existing private applications bucket caps files at 10 MB, while vehicle upload support requires 15 MB. Configure a separate private staging bucket with a 15 MB limit, first on staging, and validate real uploads/downloads/PDF history there. No production bucket was altered. |
| 5. Stripe cryptographic signature verification | PASS | Real Stripe SDK tests verify exact raw bytes and their ledger hash, reject tampered/wrong-secret signatures, and return a retryable 500 when persistence fails. No network payment call is made by these tests. |
| Checkout/weekly subscriptions/provider retries/synchronization | BLOCKED | Stripe connector requires reauthentication and real test-mode credentials are still absent; the supplied keys are live-mode and are not used for preview tests. No real test Checkout, subscription, invoice-failure or provider event replay was performed. Existing service-level replay/payment-only tests pass; they are not provider integration proof. |
| 6. External operational runner implementation | PASS | Windows runner defaults to read-only extraction, validates project identity, rejects legacy snapshots, holds an exclusive lock, bounds execution and suppresses customer payload logs. Scheduled preflight registration is read-only, Limited/Interactive, and prevents overlapping instances. |
| Workbook execution and scheduled ownership | BLOCKED | `Fleets.xlsx`, `Invoice-list.xls`, and `RentalClientList.xlsx` are absent at configured paths. Dry-run returned BLOCKED, exit 2, with no writes. No scheduler was registered. Excel/interactive workstation execution remains an external dependency. |
| Queue safety | PASS | Existing queue has no rows and source has no registered handlers. Worker now refuses startup without handlers and filters lease recovery/claiming to registered job types, rather than exhausting unsupported jobs. No production queue rows were changed. |
| 7. Rate-limit migration on isolated local staging | PASS | Dedicated loopback PostgreSQL 17 database: additive migration applied twice; RLS/grants and real role restrictions verified; 20 concurrent requests across two instances counted atomically; decrement/reset and transaction-scoped advisory lock exclusivity passed. |
| Cloud staging migration and deployed counters | BLOCKED | No separate Supabase staging credentials. Local PostgreSQL proof is not a deployed Supabase/API end-to-end result. |
| Production rate-limit DDL | BLOCKED | `api_rate_limits` is absent in production and the new migration is not in production history. Applying `20261009090000_add_serverless_rate_limits.sql` requires explicit approval after staging validation. Historical migrations were not renamed/replayed. |
| 8. Windows Vercel build | PASS | Root cause reproduced: Vercel's plain environment object lost the system path with mixed `Path`/`PATH` keys. `npm run vercel:build` normalizes the environment before launching the installed CLI and passes. No global PATH, dependency source or CLI installation was patched. |
| Remote Linux build | PASS | Current source deployment completed a remote `vercel build` and reached READY using one function. |
| 9. Local checks/builds | PASS | `npm run lint`, `npm run test`, `npm run validate`, `npm run build`, and `npm run vercel:build` all exit 0. Final suite: 522 tests across 57 files. |
| Protected preview public/browser smoke | PASS | Desktop and mobile public routes load without uncaught JavaScript errors or horizontal overflow. Entry JS/CSS bytes match the local artifact. Anonymous access redirects to Vercel protection. Missing private/build files return 404. |
| Preview liveness | PASS | `/api/live` returns 200 JSON/no-store. `environment: production` is NODE_ENV, not the deployment target. |
| Preview dependency health/business APIs | BLOCKED | `/api/health` returns expected 503 because staging credentials are missing. Private reads and webhook writes remain guarded 503. This is not a healthy, fully integrated application release. |
| Static secret/publication check | PASS | Eighty-four static files scanned; no supplied service-role/JWT/checkout/database secrets found. Packaging excludes source maps, private source/configuration and utility endpoints from public output. |
| 10. Worktree preservation | PASS | Snapshot taken at continuation start. The same 236 tracked files remain dirty; 211 are line-ending/whitespace-only compared with HEAD, 25 have content differences including migration work. The initial continuation preserved all changes without committing; the subsequent push request commits only the migration and hosting cleanup, preserving unrelated local changes. |
| Whole-tree raw `git diff --check` | FAIL | Existing CRLF/whitespace differences remain. CRLF-aware check only reports unchanged `CLAUDE.md` lines 11–12. Continuation files pass the CRLF-aware check; unrelated files were not reformatted. |
| 11. Current live availability | FAIL | The current live domain returned HTTP 503. No live routing was changed; Production release remains approval-gated. |
| 12. Production cutover gate | BLOCKED | Cloud staging, real test payments, operational inputs, fallback verification, production DDL authorization, domain verification and explicit release authorization remain outstanding. No live DNS or endpoints were changed. |

## Environment separation

Production configured names:

`ADMIN_EMAIL`, `APP_URL`, `PUBLIC_SITE_URL`, `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_VEHICLE_IMAGES_BUCKET`, `DATABASE_URL`, `SUPABASE_DB_URL`, `POSTGRES_SSL_CA`, `JWT_SECRET`, `CHECKOUT_LINK_SECRET`, `INDEXNOW_KEY`, `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GALA_CRON_ENABLED`, `INDEXNOW_ENABLED`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`.

Private database/service-role/signing values and the server certificate are stored as Sensitive. Public build-time values contain public values only. Production indexing and cron are disabled. `ADMIN_PASSWORD` was deliberately not imported as a production fallback login.

Preview: only the disabled write flag is configured. The adapter rejects the actual production Supabase ref and production PostgreSQL ref in a writable preview, even if the production URL is copied into the staging marker. A restricted Stripe test key is accepted as test-mode, but must have the required provider permissions. Real keys/account identity still need verification; fake keys are never used to bypass the deployed guard.

Still needed for Preview, by name only: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` or `SUPABASE_DB_URL`, `POSTGRES_SSL_CA`, `GALA_STAGING_SUPABASE_URL`, `ADMIN_EMAIL`, `JWT_SECRET`, `CHECKOUT_LINK_SECRET`, `APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GALA_PREVIEW_EMAIL_TO`, and `SUPABASE_UPLOAD_STAGING_BUCKET` for 15 MB private staging. `RESEND_API_KEY` is required to verify notifications. Use separate staging signing secrets and an isolated admin fixture.

The supplied live Stripe key was verified against the GalaRentals account with a read-only request, and the Resend account has a verified GalaRentals domain. Both keys are now configured only in Production. The existing webhook signing secret is still required; no payment or email was sent. `CONTACT_FROM_EMAIL`/`CONTACT_TO_EMAIL` placeholders were not copied; repo defaults exist, but the actual sender/inbox and Resend domain authorization must be verified. `CRON_SECRET` is needed only when approved cron ownership is enabled. `GALA_LOCAL_STAGING_DB_URL` belongs only to the disposable local test harness, never to Vercel.

## Fixes and observed failure handling

- npm 10's dependency resolver failed with `edgesOut` while resolving Vitest peer dependencies. Running the same targeted, semver-compatible update with npm 11 resolved it. Twenty-five package versions changed. Express 4.22.3, React Router 7.18.4 and Vitest 4.1.11 stay in their existing major versions; Vite/React architecture was preserved.
- A continuation snapshot under `.vercel/` was inadvertently discovered by Vitest. Excluding generated `.vercel/**` output fixed discovery; original source tests were retained.
- The existing private bucket's real 10 MB cap was below the declared vehicle limit. A separate configurable private bucket, signed bucket binding and server preflight checks now handle this explicitly. Separate staging cleanup only selects old `staging/<uuid>/<field>` paths, retaining recent/unknown timestamps and unrelated documents; the original deletion confirmation remains required.
- Strict PostgreSQL verification initially failed with SELF_SIGNED_CERT_IN_CHAIN. The initially located `CACert.crt` was empty and was not trusted. The owner-supplied `prod-ca-2021.crt` validated successfully. Vercel now verifies certificates; connection strings cannot override the explicit SSL settings. Standalone server behavior was retained.

## Supported operational arrangement

Run from the authorized Windows workstation, outside Vercel:

```powershell
npm run operations:workbooks -- "--env-file=C:\path\to\private-gala.env"
```

This is extraction only and logs aggregate counts, not applicant payloads. Set the private file's `GALA_FLEET_CLIENT_WORKBOOK_PATH`, `GALA_FLEET_WORKBOOK_PATH`, and `GALA_FLEET_INVOICE_WORKBOOK_PATH` to actual files. The original importer uses Excel COM; it requires a working interactive Windows/Excel session, not an unattended Linux/function worker.

After validating file availability and the read-only run, the owner can register a read-only daily preflight:

```powershell
powershell.exe -NoProfile -File scripts/register-workbook-preflight.ps1 -PrivateEnvironmentFile "C:\path\to\private-gala.env" -DailyAt "02:30"
```

Schedule time follows the Windows workstation clock; verify it against the intended Sydney operation time. No task was registered in this session. Real workbook imports remain an explicit, reviewed operator action using `--apply --confirm=GALA_WORKBOOK_SYNC_APPROVED`; no such command was executed. Retire duplicate GalaRentals schedules only after ownership is verified. Do not touch unrelated projects' tasks.

The queue worker is not needed for current synchronous PDF/email routes and has no implemented handlers. Keep it disabled until real handlers/job ownership are introduced and tested. The revised worker cannot silently consume unsupported jobs. No external worker or production cron was disabled/cancelled by this continuation.

## Verification commands and evidence

```powershell
npm run lint
npm run test
npm run validate
npm run build
npm run vercel:build
npm audit --json
npm audit --omit=dev --json
git status --short
git diff --stat
git diff --check
```

For the isolated local PostgreSQL fixture, use `npm run verify:rate-limits-staging` with `GALA_LOCAL_STAGING_DB_URL` pointing only to `127.0.0.1:55472/galarentals_staging`. The script refuses other targets. It creates test roles/table only on that dedicated local database. Production schema reads used READ ONLY transactions. No customer data was copied into the fixture.

Private local evidence is under ignored `.vercel/`: validation logs/results, Windows Vercel build logs, audit JSON, browser smoke results, baseline hashes and source copies. No secrets are copied into this report. The fixture container is task-owned `galarentals-migration-staging`, separate from other local projects, and was stopped after verification. It was not deleted.

## Exact remaining account/operator actions

1. **Supabase staging:** provide an existing isolated GalaRentals staging configuration or authorize provisioning a separate non-default branch/environment without production customer data. Verify the schema and supply its anon/service-role/session-pooler credentials and an isolated admin account through a private file. Do not use default main as staging. Supabase production recovery is no longer required.
2. **Private upload staging:** create/authorize a private `gala-upload-staging` bucket with a 15 MB limit and JPG/PNG/WebP support on staging; configure `SUPABASE_UPLOAD_STAGING_BUCKET`; validate uploads and retention. Prepare the corresponding production bucket only after the staging result is accepted. The current public vehicle-images bucket must not be used for identity-document staging.
3. **Stripe:** reconnect the Stripe connector to the correct GalaRentals account, or provide private real test-mode credentials and a test webhook signing secret. Confirm account identity, then verify test Checkout, weekly subscription dates, failure/update events, exact signature delivery and database-backed duplicate/retry handling. Later supply the existing production credentials; do not create replacement live customers/subscriptions or change the current destination yet.
4. **Email:** provide Resend test delivery access, a controlled preview inbox and verified sender/domain configuration. Preview recipients are forcibly redirected to that inbox; no real campaign/customer email was sent.
5. **Workbooks:** provide the three real file paths and an authorized interactive Windows/Excel operator. Validate extraction before registering preflight or approving imports. Missing files cannot be repaired by a Vercel process.
7. **Release approvals after staging passes:** approve applying only the new production rate-limit migration, domain verification/SSL and exact Vercel-supplied DNS records, then the controlled Production deployment/live endpoint cutover. Preserve email DNS, original webhook destination/signing compatibility and signing secrets for outstanding links. Retain the validated rollback deployment until stability is proven.

## Rollback status

Use the [cutover/rollback guide](VERCEL_MIGRATION.md). A Vercel rollback target must be a previously validated Production deployment. Preserve the shared database, customer/subscription records and event ledger; reconcile in-flight events before replay.

## Supabase MCP request

The direct Codex Supabase MCP server was added globally with the exact requested project ref/features. OAuth completed successfully, and `codex mcp list` reports `supabase` enabled with OAuth. `/mcp` is the interactive Codex UI inspection command; this session used the CLI verification. Existing Supabase agent skills were already available and used; the optional reinstall was not needed. Project `.codex/config.toml` was not modified.

Official supporting guidance: [Supabase PostgreSQL TLS](https://supabase.com/docs/guides/database/connecting-to-postgres), [Vercel local build](https://vercel.com/docs/cli/build), [Vercel deployment operations](https://vercel.com/docs/deployments).

## Continuation files

The exact continuation file inventory is recorded below. Earlier migration work and unrelated CRLF changes remain in place; these changes were not staged into a combined commit.

- `.env.example`
- `api/db/postgres-tls.test.ts`
- `api/db/postgres.ts`
- `api/index.ts`
- `api/previewConfiguration.test.ts`
- `api/previewConfiguration.ts`
- `api/routes/webhooks.signature.test.ts`
- `api/services/directUploads.test.ts`
- `api/services/directUploads.ts`
- `api/services/jobQueue.test.ts`
- `api/services/jobQueue.ts`
- `api/workers/backgroundWorker.ts`
- `docs/VERCEL_ENVIRONMENT.md`
- `docs/VERCEL_MIGRATION.md`
- `docs/VERCEL_MIGRATION_RESULT.md`
- `docs/VERCEL_PRODUCTION_READINESS.md`
- `package-lock.json`
- `package.json`
- `scripts/cleanup-orphaned-documents.test.ts`
- `scripts/cleanup-orphaned-documents.ts`
- `scripts/configure-vercel-production.mjs`
- `scripts/register-workbook-preflight.ps1`
- `scripts/vercel-local.mjs`
- `scripts/verify-rate-limits-staging.ts`
- `scripts/windows-process-env.mjs`
- `scripts/windows-process-env.test.ts`
- `scripts/workbook-operations.mjs`
- `scripts/workbook-operations.test.ts`
- `src/lib/api.ts`
- `vite.config.ts`

## Repository hosting cleanup and push

Hosting configuration now targets Vercel. Obsolete provider configuration and deployment documentation have been deleted, hosting references removed, and Node 22 recorded in `.nvmrc`. Private `*.env` files are excluded from Git and uploads. The reviewed migration is committed on `chore/galarentals-vercel-migration` rather than the production branch. No production deployment or live routing change is authorized by this push.
