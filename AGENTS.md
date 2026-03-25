# AGENTS.md

This file documents agent-facing workflows and commands for this repository.

## Core Commands

Use these from the repository root:

- Install dependencies: `npm ci` (or `npm install`)
- Start local app server: `npm run dev`
- Start production server (serves built frontend): `npm start`
- Build production assets: `npm run build`
- Preview build: `npm run preview`
- Type-check: `npm run lint`
- Run tests: `npm run test`
- Validate before deploy: `npm run validate`
- Clean build output: `npm run clean`

## Workflow Commands

### Database and migrations

- Print the base schema SQL: `node scripts/seed-schema.js`
- Apply payment workflow migration: `npm run migrate:payment-workflow`
- Apply legacy snake_case payment workflow repair: `npm run migrate:legacy-snake-payment-workflow`
- Apply active vehicle allocation migration: `npm run migrate:vehicle-allocation`
- Apply operational history migration: `npm run migrate:operational-history`
- Apply application index migration: `npm run migrate:application-indexes`
- Verify the production schema contract: `npm run verify:schema-contract`
- Seed the database destructively: `node scripts/pg-seed.js`

### Supabase and admin setup

- Create the private storage bucket: `npx tsx scripts/setup-bucket.ts`
- Create the admin user: `node scripts/seed-admin.js <email> <password>`
- Reset the admin user: `node scripts/reset-admin.js <email> <password>`

### Stripe operations

- Verify Stripe configuration and reusable catalog: `npm run stripe:setup`
- Preview a destructive Stripe test-data reset: `npm run stripe:reset`

### Fleet and document maintenance

- Sync realtime fleet data: `npm run sync:realtime-fleet`
- Clean orphaned documents: `npm run clean:documents`

## Safety Notes

- `scripts/check-status.js` and `scripts/pg-seed.js` require `SUPABASE_DB_URL` (or `DATABASE_URL`).
- `npm run verify:schema-contract` requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `scripts/pg-seed.js` is destructive and requires `ALLOW_SCHEMA_RESET=true`.
- `scripts/seed-admin.js` and `scripts/reset-admin.js` require explicit admin credentials via args or env.
- `npm run stripe:reset` is destructive and should only be used when resetting test data.
- `npm run clean:documents` removes orphaned documents and should be reviewed before running in production-like environments.

## Deployment Workflow

- Run `npm run validate` before every deploy.
- Run `npm run build` to produce `dist/` and `server-dist/`.
- Start the production server with `npm start`.
- Render uses `npm ci --include=dev && npm run validate && npm run build` for builds and `npm start` for runtime.
