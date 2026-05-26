-- Supabase destructive reset for local development only.
-- Do not run this in shared/staging/production environments.

DO $$
BEGIN
  IF current_setting('app.allow_destructive_local_reset', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      '00_reset.sql is blocked by default. Set app.allow_destructive_local_reset=on only for an intentional local database reset.';
  END IF;
END $$;

DROP TABLE IF EXISTS lease_agreements CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS rentals CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS cars CASCADE;
