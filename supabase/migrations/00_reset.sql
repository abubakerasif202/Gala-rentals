-- Supabase destructive reset for local development only.
-- This file is kept in the migration chain for legacy local workflows, but it
-- must not fail hosted Supabase branch resets that replay every migration.

DO $$
BEGIN
  IF current_setting('app.allow_destructive_local_reset', true) IS DISTINCT FROM 'on' THEN
    RAISE NOTICE
      '00_reset.sql skipped. Set app.allow_destructive_local_reset=on only for an intentional local destructive reset.';
    RETURN;
  END IF;

  DROP TABLE IF EXISTS lease_agreements CASCADE;
  DROP TABLE IF EXISTS bookings CASCADE;
  DROP TABLE IF EXISTS rentals CASCADE;
  DROP TABLE IF EXISTS applications CASCADE;
  DROP TABLE IF EXISTS cars CASCADE;
END $$;
