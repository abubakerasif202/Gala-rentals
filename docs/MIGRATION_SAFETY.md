# Migration safety

Run `npm run check:migrations` before any Supabase migration command. The check blocks new or modified forward migrations containing `DROP TABLE`. Historical destructive snapshots are hash-pinned only so CI can detect changes; this does not make them safe to replay.

Before applying any migration to production:

1. Read the production Supabase migration ledger and compare it with the repository filenames and checksums.
2. Confirm the target migration has not already been applied under another name or manually.
3. Use additive migrations with explicit backfills and rollback notes.
4. Back up and test restoration for any operation that can remove or rewrite data.
5. Never run `00_reset.sql` or the optimized schema snapshot against production.

Migration execution is intentionally a separate, explicitly approved operation. CI validation must not apply migrations.

An isolated local reset/test migration may use `-- migration-safety: local-reset-only` only when its filename also contains `reset` or `test`. That marker is forbidden for production forward migrations.
