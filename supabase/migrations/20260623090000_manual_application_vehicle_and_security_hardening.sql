-- Gala Rentals applications are approved with manually typed vehicle/rego text.
-- Public submissions must go through the Express API; anon Supabase inserts are disabled.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS assigned_vehicle_text TEXT,
  ADD COLUMN IF NOT EXISTS assigned_vehicle_rego TEXT,
  ADD COLUMN IF NOT EXISTS approved_weekly_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS approved_subscription_start_date DATE;

UPDATE public.applications
SET approved_weekly_price_cents = ROUND(approved_weekly_price * 100)::INTEGER
WHERE approved_weekly_price IS NOT NULL
  AND approved_weekly_price_cents IS NULL;

UPDATE public.applications
SET approved_subscription_start_date = intended_start_date
WHERE intended_start_date IS NOT NULL
  AND approved_subscription_start_date IS NULL;

UPDATE public.applications
SET assigned_vehicle_text = approved_vehicle
WHERE approved_vehicle IS NOT NULL
  AND NULLIF(BTRIM(assigned_vehicle_text), '') IS NULL;

DROP POLICY IF EXISTS public_submit_application ON public.applications;
REVOKE INSERT ON TABLE public.applications FROM anon;

ALTER TABLE IF EXISTS public.rentals
  DROP CONSTRAINT IF EXISTS rentals_car_id_fkey;
ALTER TABLE IF EXISTS public.rentals
  ADD CONSTRAINT rentals_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.bookings
  DROP CONSTRAINT IF EXISTS bookings_car_id_fkey;
ALTER TABLE IF EXISTS public.bookings
  ADD CONSTRAINT bookings_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS public.lease_agreements
  DROP CONSTRAINT IF EXISTS lease_agreements_car_id_fkey;
ALTER TABLE IF EXISTS public.lease_agreements
  ALTER COLUMN car_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.lease_agreements
  ADD CONSTRAINT lease_agreements_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE SET NULL;
