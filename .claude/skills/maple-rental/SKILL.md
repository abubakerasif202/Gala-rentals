# Gala Rentals Development Rules

Use the root `AGENTS.md` as the authoritative engineering guide for this repository.

## Architecture

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Query.
- Backend: Express and TypeScript.
- Data and private uploads: Supabase.
- Payments: Stripe Checkout and Billing with verified webhooks.
- Deployment: Render using `render.yaml`.
- Tests: Vitest.

## Critical payment-only contract

- Admin enters `Vehicle / Number Plate` as plain text.
- Payment-link creation must not send `car_id`.
- Checkout tokens must use `carId: null`.
- Successful checkout marks the application `Paid` only.
- Checkout completion must not mutate car status or create rental rows.

## Working rules

- Inspect the current source and tests before editing.
- Keep changes scoped and preserve unrelated worktree changes.
- Keep secrets out of source, logs, fixtures, and summaries.
- Do not deploy, push, rotate secrets, or apply production migrations without explicit approval.
- Prefer existing libraries and source-of-truth files over generated output.

## Validation

Run the repository gate after changes:

```bash
npm run lint
npm run test
npm run validate
npm run build
git diff --check
```
