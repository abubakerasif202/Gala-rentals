# AGENTS.md

This file documents agent-facing workflows and commands for this repository.

## Local Developer Commands

Use these from the repository root:

- Install dependencies: `npm ci` (or `npm install`)
- Start local app server: `npm run dev`
- Start production server (serves built frontend): `npm start`
- Build production assets: `npm run build`
- Preview build: `npm run preview`
- Type-check: `npm run lint`
- Validate before deploy: `npm run validate`
- Clean build output: `npm run clean`

Script safety notes:

- `scripts/check-status.js` and `scripts/pg-seed.js` require `SUPABASE_DB_URL` (or `DATABASE_URL`).
- `scripts/pg-seed.js` is destructive and requires `ALLOW_SCHEMA_RESET=true`.
- `scripts/seed-admin.js` and `scripts/reset-admin.js` require explicit admin credentials via args or env.
