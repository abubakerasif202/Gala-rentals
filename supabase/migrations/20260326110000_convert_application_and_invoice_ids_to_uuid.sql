BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT uuid_generate_v4();

UPDATE public.applications
SET id_uuid = uuid_generate_v4()
WHERE id_uuid IS NULL;

ALTER TABLE public.applications
  ALTER COLUMN id_uuid SET NOT NULL;

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS application_id_uuid UUID;

UPDATE public.rentals AS rentals
SET application_id_uuid = applications.id_uuid
FROM public.applications AS applications
WHERE rentals.application_id = applications.id
  AND rentals.application_id_uuid IS NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS application_id_uuid UUID;

UPDATE public.bookings AS bookings
SET application_id_uuid = applications.id_uuid
FROM public.applications AS applications
WHERE bookings.application_id = applications.id
  AND bookings.application_id IS NOT NULL
  AND bookings.application_id_uuid IS NULL;

ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS application_id_uuid UUID;

UPDATE public.lease_agreements AS agreements
SET application_id_uuid = applications.id_uuid
FROM public.applications AS applications
WHERE agreements.application_id = applications.id
  AND agreements.application_id_uuid IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.rentals
    WHERE application_id_uuid IS NULL
  ) THEN
    RAISE EXCEPTION 'UUID backfill failed for rentals.application_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lease_agreements
    WHERE application_id_uuid IS NULL
  ) THEN
    RAISE EXCEPTION 'UUID backfill failed for lease_agreements.application_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE application_id IS NOT NULL
      AND application_id_uuid IS NULL
  ) THEN
    RAISE EXCEPTION 'UUID backfill failed for bookings.application_id';
  END IF;
END $$;

ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_application_id_fkey;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_application_id_fkey;

ALTER TABLE public.lease_agreements
  DROP CONSTRAINT IF EXISTS lease_agreements_application_id_fkey;

DROP INDEX IF EXISTS public.idx_rentals_application_id;
DROP INDEX IF EXISTS public.idx_rentals_live_application_unique;
DROP INDEX IF EXISTS public.idx_bookings_application_id;
DROP INDEX IF EXISTS public.idx_lease_agreements_application_id;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_pkey;

ALTER TABLE public.applications
  RENAME COLUMN id TO legacy_id;

ALTER TABLE public.applications
  RENAME COLUMN id_uuid TO id;

ALTER TABLE public.applications
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE public.applications
  ADD CONSTRAINT applications_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_legacy_id
  ON public.applications(legacy_id);

ALTER TABLE public.rentals
  RENAME COLUMN application_id TO legacy_application_id;

ALTER TABLE public.rentals
  RENAME COLUMN application_id_uuid TO application_id;

ALTER TABLE public.rentals
  ALTER COLUMN application_id SET NOT NULL;

ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_rentals_application_id
  ON public.rentals(application_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_live_application_unique
  ON public.rentals(application_id)
  WHERE lower(status) IN ('active', 'overdue');

ALTER TABLE public.bookings
  RENAME COLUMN application_id TO legacy_application_id;

ALTER TABLE public.bookings
  RENAME COLUMN application_id_uuid TO application_id;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bookings_application_id
  ON public.bookings(application_id);

ALTER TABLE public.lease_agreements
  RENAME COLUMN application_id TO legacy_application_id;

ALTER TABLE public.lease_agreements
  RENAME COLUMN application_id_uuid TO application_id;

ALTER TABLE public.lease_agreements
  ALTER COLUMN application_id SET NOT NULL;

ALTER TABLE public.lease_agreements
  ADD CONSTRAINT lease_agreements_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lease_agreements_application_id
  ON public.lease_agreements(application_id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT uuid_generate_v4();

UPDATE public.invoices
SET id_uuid = uuid_generate_v4()
WHERE id_uuid IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN id_uuid SET NOT NULL;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_pkey;

ALTER TABLE public.invoices
  RENAME COLUMN id TO legacy_id;

ALTER TABLE public.invoices
  RENAME COLUMN id_uuid TO id;

ALTER TABLE public.invoices
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_legacy_id
  ON public.invoices(legacy_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
