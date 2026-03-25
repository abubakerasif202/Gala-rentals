-- Forward-only repair for legacy snake_case schemas.
-- Do not edit historical migrations to add these columns.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND column_name = 'license_number'
  ) THEN
    ALTER TABLE public.applications
      ADD COLUMN IF NOT EXISTS license_back_photo TEXT,
      ADD COLUMN IF NOT EXISTS assigned_car_id BIGINT REFERENCES public.cars(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_bond NUMERIC CHECK (approved_bond >= 0),
      ADD COLUMN IF NOT EXISTS approved_weekly_price NUMERIC CHECK (approved_weekly_price >= 0),
      ADD COLUMN IF NOT EXISTS payment_link_version INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS pending_checkout_session_id TEXT;

    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_applications_assigned_car_id
        ON public.applications(assigned_car_id)
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rentals'
      AND column_name = 'car_id'
  ) THEN
    ALTER TABLE public.rentals
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
