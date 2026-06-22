# Global Codex Operating Rules

- Production-ready, copy-paste solutions only.
- Prefer PowerShell for Windows automation.
- Root-cause first when debugging errors.
- Provide exact fixes, fallback only when needed.
- Optimize for security, performance, maintainability.
- Include validation commands after changes.
- For complex tasks: Plan → Build → Verify → Optimize.
- If user says "ultra mode", optimize aggressively.
- If user says "one-command", provide one executable script.
- If user says "Retry", re-check the previous answer against these rules and regenerate.

--- project-doc ---

# AGENTS.md — Rental SaaS Engineering Guide

This is the main engineering guide for Codex agents working on a production-ready rental SaaS project in the Gala Rentals style. Use it for vehicle rental, equipment rental, hire cars, property rentals, subscription-based asset rental, and similar operational rental platforms.

If this guide is being used inside an existing codebase, inspect the current application behavior before changing it. Preserve existing payment and rental workflows unless the user explicitly asks for a migration. In the current Gala Rentals app, payment completion is intentionally payment-only: successful checkout marks the application `Paid`, uses checkout token `carId: null`, does not mutate car status, and does not create rental rows automatically.

## 1. Product Overview

Build the app as a premium rental management SaaS, not a demo. The product should support businesses that rent vehicles, equipment, hire cars, properties, or other subscription-based assets.

The platform should include:

- Public marketing site with premium trust-focused copy.
- Customer rental application form.
- Admin dashboard for application review and operations.
- Application review, pricing approval, and rejection workflows.
- Stripe Checkout subscription flow.
- Bond, deposit, and payment handling where required.
- Rental agreement generation.
- Toll, notice, form, and operational document generation.
- Customer document uploads.
- Admin-only operational tools.
- Production health checks and deployment verification.

Keep the product split into clear lifecycle stages:

1. Customer applies.
2. Admin reviews and approves pricing/start date.
3. Customer completes payment through Stripe.
4. Backend confirms payment through Stripe webhooks.
5. Rental activation runs only when the project business rules allow it.
6. Admin manages documents, notices, operational records, and follow-up work.

## 2. Core Tech Stack

Use this stack unless the repository already has a different production stack:

- Frontend: React + TypeScript + Vite.
- Styling: Tailwind CSS.
- Backend: Node.js + Express + TypeScript.
- Database, auth, and storage: Supabase.
- Payments: Stripe Checkout + Stripe Billing subscriptions.
- PDF and documents: `pdf-lib` or `pdfkit`.
- Hosting: Render for full-stack deployment.
- Testing: Vitest.
- Validation: Zod.
- Data fetching: TanStack Query.
- Forms: controlled React forms with clear validation.

Prefer the repo's existing libraries and patterns over adding new dependencies. Add a dependency only when it materially reduces risk, complexity, or maintenance burden.

## 3. Architecture Rules

Keep customer application, admin approval, payment, and rental activation as separate workflows. Do not collapse them into one client-driven action.

Payment and billing rules:

- Do not create duplicate Stripe subscriptions.
- Never start rental activation unless payment state is valid.
- Use idempotent backend logic for payment activation and webhooks.
- Keep payment-sensitive logic server-side only.
- Admin UI must not directly trust client state for billing, pricing, or rental status.
- Store Stripe customer IDs, checkout session IDs, subscription IDs, and payment state in the database.
- Use unique constraints, idempotency keys, and webhook event ledgers to prevent duplicate fulfillment.
- Verify Stripe webhook signatures before processing payloads.
- Never expose Stripe secret keys, Supabase service role keys, database credentials, Resend keys, or other secrets to the frontend.

Rental lifecycle rules:

- Store important lifecycle dates in the database.
- Use Australia/Sydney local date handling for rental dates unless project config says otherwise.
- Treat subscription start date, rental start date, approval date, paid date, activation date, and cancellation date as distinct fields when the workflow needs them.
- Do not infer operational rental state from UI labels alone.
- Do not trust frontend-provided price, status, Stripe ID, or activation state.

Existing-project rule:

- If the current codebase deliberately separates payment completion from rental activation, preserve that design. For Gala Rentals specifically, admin enters `Vehicle / Number Plate` as plain text, payment-link creation must not send `car_id`, checkout tokens use `carId: null`, checkout completion marks the application `Paid` only, and car/rental records are not mutated automatically.

## 4. Main Features To Generate

Generate complete, production-oriented modules. Avoid placeholder workflows that look complete but bypass backend validation, auth, payment safety, document storage, or audit requirements.

### Public Site

Include:

- Home page.
- Pricing page.
- Rental fleet/listing page.
- FAQ page.
- Contact page.
- Apply now CTA.
- SEO metadata.
- Responsive mobile-first layout.
- Premium trust-focused copy.

Public pages should load fast, render correctly on mobile, and avoid exposing admin-only or customer-private routes in public navigation. Use clear CTAs and realistic rental business copy rather than generic software filler.

### Customer Application Flow

Include:

- Applicant details.
- Contact details.
- Address.
- Driver/license or identity details depending on rental type.
- Rental start date preference.
- Vehicle, item, equipment, or property selection where the business model supports selection.
- Upload documents.
- Terms acceptance.
- Submit application.
- Confirmation screen.

Implementation requirements:

- Validate every payload server-side with Zod.
- Normalize phone, email, dates, and optional blank fields consistently.
- Keep optional form fields nullable when the UI allows blanks.
- Do not make optional form fields `NOT NULL`.
- Show loading, error, success, and duplicate-submission states.
- Do not trust client-selected pricing or availability without server verification.

### Admin Dashboard

Include:

- Dashboard summary cards.
- Applications tab.
- Pending / approved / rejected / paid status.
- Application detail view.
- Approve application with locked weekly rental price.
- Set rental subscription start date.
- Generate secure Stripe Checkout link.
- Copy payment link.
- View payment state.
- View customers.
- View rentals.
- View documents.
- Generate rental agreements.
- Generate notices/forms.
- Maintenance/admin tools.

Admin requirements:

- Protect every admin route and backend endpoint.
- Treat admin changes as auditable business events.
- Keep approval, payment-link creation, rental activation, cancellation, and document generation as explicit actions.
- Use confirmation modals for destructive or irreversible actions.
- Show server-derived statuses instead of local optimistic guesses for billing and rental state.
- Keep the dashboard usable on mobile and desktop.

### Stripe Payment Flow

Implement:

- Stripe Checkout hosted subscription flow.
- Customer creation/reuse.
- Subscription creation.
- Optional bond/payment setup if needed.
- Webhook handling.
- Idempotent payment activation.
- Store Stripe customer ID.
- Store Stripe checkout session ID.
- Store Stripe subscription ID.
- Store subscription start date.
- If admin-selected start date is today or past, subscription starts immediately.
- If future start date is selected, schedule subscription billing safely using Stripe-compatible parameters.
- Prevent duplicate active subscriptions.

Payment implementation rules:

- Create Checkout sessions only on the backend.
- Derive price, bond, and subscription metadata from server-side records.
- Use Stripe idempotency keys for session/subscription creation where retries are possible.
- Persist checkout intent/session state before sending links where the workflow needs auditability.
- Handle webhook retries and duplicate events safely.
- Record unhandled webhook event types without treating them as successful payment activation.
- Do not log full Stripe payloads or secrets.

### Rental Activation

Default greenfield flow after successful payment:

- Mark application as paid.
- Create or update rental record.
- Link customer, application, vehicle/item/property, and subscription.
- Lock approved price.
- Lock approved rental start date.
- Store payment metadata.
- Keep activation transactional where database supports it.

Activation safety rules:

- Activation must run from verified backend payment state, not from frontend redirects.
- Webhook activation must be idempotent.
- Prevent duplicate active rentals for the same application/subscription where the business rules require uniqueness.
- If a project intentionally requires manual operational activation after payment, do not create rental rows automatically. Capture the paid state and expose the next admin action instead.

### Documents

Include:

- Rental agreement generator.
- Admin-editable agreement template.
- PDF export.
- Saved agreement history.
- Uploaded customer documents.
- Notice/form generator similar to a toll transfer notice flow.
- PDF generation that tolerates optional blank fields where legally allowed.

Document requirements:

- Save generated document metadata and source inputs.
- Use signed or protected URLs for private documents.
- Validate uploaded file type and size.
- Avoid public access to customer documents.
- Store agreement template versions so regenerated PDFs remain auditable.
- Make PDF generation resilient to missing optional values, long names, long addresses, and multi-page content.

## 5. Database Model Guidance

Ask Codex to design migrations for:

- `customers`
- `applications`
- `rental_items` or `cars`
- `rentals`
- `payments` / `payment_state`
- `agreement_templates`
- `generated_agreements`
- `notices` / `forms`
- `uploaded_documents`
- `admin_users` if needed
- `audit_logs`

Important database rules:

- Use UUIDs or serial IDs consistently.
- Add `created_at` and `updated_at`.
- Add foreign keys.
- Add indexes for admin dashboard queries.
- Add unique protection against duplicate active subscriptions.
- Store Stripe IDs with searchable indexes.
- Keep nullable fields nullable when the UI allows blank values.
- Do not make optional form fields `NOT NULL`.

Suggested constraints and indexes:

- Unique active subscription per application when only one active subscription is allowed.
- Unique Stripe checkout session ID.
- Unique Stripe subscription ID where present.
- Index application status, payment status, customer ID, rental item ID, and date fields used by admin filters.
- Add foreign keys from rentals to applications, customers, rental items, and payment/subscription records.
- Use audit logs for admin approval, rejection, payment-link creation, activation, cancellation, document generation, and maintenance actions.

Migration rules:

- Prefer additive migrations for production safety.
- Backfill data explicitly when adding non-nullable fields.
- Do not weaken existing constraints unless the user explicitly asks and the risk is documented.
- Include rollback notes for risky migrations even if the migration system itself is forward-only.
- Verify production schema compatibility before deploy when payment or activation code depends on new columns.

## 6. UI / UX Rules

The UI should feel:

- Premium.
- Clean.
- Mobile-friendly.
- Admin-friendly.
- Fast.
- Professional.

Use:

- Dark navy / gold / white premium style by default.
- Clear section cards.
- Big readable buttons.
- Status badges.
- Loading states.
- Empty states.
- Error banners.
- Success banners.
- Confirmation modals for destructive actions.

Frontend implementation rules:

- Build the actual usable workflow as the first screen, not a marketing-only facade.
- Keep admin tables dense, readable, and scannable.
- Use responsive layouts that do not clip buttons, status badges, or form controls.
- Show precise server validation errors where safe.
- Disable submit buttons while requests are in flight.
- Keep customer-facing forms calm and obvious.
- Keep admin workflows fast: search, filter, status badges, detail drawers/pages, and copy-link actions should be easy to reach.
- Do not hide destructive actions inside ambiguous icon-only controls.

Admin dashboard must be usable on mobile and desktop.

## 7. Security Rules

Security is part of the product, not a cleanup step.

Required rules:

- Validate all backend payloads with Zod.
- Never trust frontend price/status values.
- Verify Stripe webhook signatures.
- Keep service role keys backend-only.
- Protect admin endpoints.
- Use signed or secure document URLs.
- Avoid logging secrets or full payment payloads.
- Avoid exposing customer documents publicly.
- Use least-privilege access patterns.

Additional rules:

- Use server-side authorization checks on every admin action.
- Do not rely on hidden UI controls as authorization.
- Redact tokens, API keys, database URLs, customer identity documents, and payment identifiers in logs and summaries.
- Keep CORS restrictive for production.
- Rate-limit sensitive endpoints where the stack supports it.
- Store only the payment metadata needed for operations and reconciliation.
- Do not add demo/imported data behavior into live production flows.
- Keep maintenance reset/import tools explicitly scoped and confirmation-gated.

## 8. Testing Requirements

For any change, run available checks:

```powershell
npm run lint
npm run test
npm run validate
npm run build
git diff --check
```

If a script is not available, report that clearly and run the nearest repo-native check.

Add tests for:

- Application approval.
- Stripe checkout creation.
- Webhook activation.
- Duplicate subscription prevention.
- Selected subscription start date.
- Document generation.
- Optional blank PDF fields.
- Admin API validation.
- Health endpoints.

Testing expectations:

- Payment/admin/backend changes require the full validation suite.
- Document-only changes should at least run `git diff --check` and any markdown/lint checks the repo provides.
- Regression tests should target the business rule, not implementation trivia.
- Do not delete or weaken tests to make a change pass.
- When a failure is unrelated or pre-existing, capture exact evidence and avoid hiding it.

## 9. Deployment Rules

Assume Render unless configured otherwise.

Default production configuration:

- Build command: `npm run validate && npm run build`
- Start command: `npm start`
- Health endpoint: `/api/health`
- Live endpoint: `/api/live`

Deployment requirements:

- Production smoke after deploy.
- Verify public frontend asset hashes after deploy.
- Verify database migration applied.
- Verify `paymentActivationMode` is transactional when payment activation depends on database transactions.
- Do not call deploy complete until production health and asset checks pass.

Deployment safety rules:

- Do not trigger deployment without explicit user approval.
- Do not rotate secrets, force-push, hard reset, delete production data, or run irreversible database changes without explicit confirmation.
- Check Render build logs when production behavior differs from local validation.
- Verify the deployed commit or asset hash matches the intended build.
- After deploy, check both liveness and dependency-aware health.

Production smoke commands:

```powershell
curl.exe https://www.galarentals.com.au/api/live
curl.exe https://www.galarentals.com.au/api/health
```

Use the configured production domain for non-current-brand projects.

## 10. Codex Workflow Rules

Agents must:

- Read this file before making changes.
- Search the repo before editing.
- Inspect existing routes, services, tests, and schemas before changing payment, admin, document, or rental behavior.
- Make the smallest safe change.
- Avoid unrelated refactors.
- Preserve existing payment and rental workflows.
- Avoid touching unrelated files.
- Stage only intended files.
- Explain changed files.
- Report commands run.
- Report remaining risks honestly.
- Never claim deploy success unless production is verified.

Operational rules:

- Prefer PowerShell for Windows automation.
- Use `rg` or `rg --files` for repo searches where available.
- Verify the repo root before running `git`, `npm`, migrations, or deploy commands.
- Keep secrets out of logs, summaries, tests, fixtures, and docs.
- Do not patch generated build output unless the repo explicitly treats it as source.
- Prefer source-of-truth edits over built artifacts.
- Preserve user changes already present in the worktree.
- Do not stage unrelated untracked files.
- For complex tasks, work in this order: Plan, Build, Verify, Optimize.

Before changing payment flow, inspect:

- `api/routes/applications.ts`
- `api/routes/stripe.ts`
- `api/services/stripeCheckoutService.ts`
- `api/paymentActivation.ts`
- `api/services/stripeWebhookService.ts`
- `api/validation.ts`
- `src/lib/api.ts`
- `src/pages/AdminDashboard.tsx`
- Relevant API, validation, webhook, payment, and admin tests.

## 11. Output Format For Codex

For every non-trivial task, finish with:

- Summary.
- Files changed.
- Tests run.
- Build result.
- Migration notes.
- Deployment notes.
- Remaining blockers.

For Gala Rentals repo-facing work, use this more explicit close-out:

- Changed files and what changed.
- Test results, including pass/fail for each command run.
- Risks or notable residual concerns.
- Manual follow-up, such as migrations, env vars, deploys, or secret rotation.
- Deployment checks, when a deploy was performed or requested.

Never claim a test, build, migration, commit, push, or deploy succeeded unless it actually ran and succeeded in the current work session.
