# Load Testing

Galarentals has a dependency-free load-test runner at `scripts/load-test.mjs`. It is designed for local or staging checks first and only exercises read-only routes by default.

## Profiles

- `smoke`: `/api/live` and `/api/health`.
- `read-only-api`: `/api/live`, `/api/health`, `/api/stripe/rental-plans`, and `/api/stripe/lease-settings`.
- `public-pages`: public React routes such as `/`, `/pricing`, `/apply`, `/faq`, and `/contact`.

The runner does not submit applications, trigger Stripe checkout, call admin write endpoints, upload files, send email, or mutate rental/payment state.

## Local Run

Start the app in one PowerShell window:

```powershell
Set-Location -LiteralPath 'C:\Users\abuba\Gala-rentals'
npm run dev
```

Run the load test from a second PowerShell window:

```powershell
Set-Location -LiteralPath 'C:\Users\abuba\Gala-rentals'
$env:LOAD_TEST_BASE_URL = 'http://localhost:3000'
npm run load:test:smoke
npm run load:test
```

Results are written to `tmp/load-test/latest.json`, which is ignored by git.

## Staging Run

```powershell
Set-Location -LiteralPath 'C:\Users\abuba\Gala-rentals'
$env:LOAD_TEST_BASE_URL = 'https://your-staging-host.example.com'
$env:LOAD_TEST_DURATION_SECONDS = '120'
$env:LOAD_TEST_CONCURRENCY = '12'
$env:LOAD_TEST_RAMP_SECONDS = '30'
npm run load:test
```

## Production Guard

Known Gala production hosts are blocked unless explicitly allowed. Do not run production load tests without approval and a rollback/monitoring window.

```powershell
Set-Location -LiteralPath 'C:\Users\abuba\Gala-rentals'
$env:LOAD_TEST_BASE_URL = 'https://www.galarentals.com.au'
$env:LOAD_TEST_ALLOW_PRODUCTION = 'true'
$env:LOAD_TEST_DURATION_SECONDS = '30'
$env:LOAD_TEST_CONCURRENCY = '2'
npm run load:test:smoke
```

Clear environment overrides when finished:

```powershell
Remove-Item Env:\LOAD_TEST_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\LOAD_TEST_ALLOW_PRODUCTION -ErrorAction SilentlyContinue
Remove-Item Env:\LOAD_TEST_DURATION_SECONDS -ErrorAction SilentlyContinue
Remove-Item Env:\LOAD_TEST_CONCURRENCY -ErrorAction SilentlyContinue
Remove-Item Env:\LOAD_TEST_RAMP_SECONDS -ErrorAction SilentlyContinue
```

## Thresholds

Default pass/fail gates:

- p95 latency must be at or below `1000` ms.
- p99 latency must be at or below `2500` ms.
- Error rate must be at or below `1%`.

Override them per run:

```powershell
$env:LOAD_TEST_P95_MS = '750'
$env:LOAD_TEST_P99_MS = '1500'
$env:LOAD_TEST_MAX_ERROR_RATE = '0.005'
npm run load:test
```

The command exits with code `1` when thresholds fail.
