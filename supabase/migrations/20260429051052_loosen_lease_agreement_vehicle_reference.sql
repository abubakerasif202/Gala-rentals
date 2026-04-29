ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS vehicle_label TEXT;

ALTER TABLE public.lease_agreements
  ALTER COLUMN car_id DROP NOT NULL;

ALTER TABLE public.lease_agreements
  DROP CONSTRAINT IF EXISTS lease_agreements_car_id_fkey;
