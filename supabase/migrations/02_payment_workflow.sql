-- Add payment workflow columns to the current snake_case Supabase schema.
-- This migration is intentionally idempotent for Supabase Preview and CI.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS approved_bond NUMERIC CHECK (approved_bond >= 0),
  ADD COLUMN IF NOT EXISTS approved_vehicle TEXT,
  ADD COLUMN IF NOT EXISTS approved_weekly_price NUMERIC CHECK (approved_weekly_price >= 0),
  ADD COLUMN IF NOT EXISTS payment_link_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_checkout_session_id TEXT;

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

DROP INDEX IF EXISTS idx_applications_assigned_car_id;
DROP INDEX IF EXISTS idx_applications_active_vehicle_allocation_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_single_active
  ON applications(email)
  WHERE lower(status) IN ('pending', 'approved', 'payment review');

CREATE INDEX IF NOT EXISTS idx_rentals_car_id
  ON rentals(car_id);

CREATE INDEX IF NOT EXISTS idx_rentals_application_id
  ON rentals(application_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_live_car_unique
  ON rentals(car_id)
  WHERE lower(status) IN ('active', 'overdue');

CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_live_application_unique
  ON rentals(application_id)
  WHERE lower(status) IN ('active', 'overdue');

CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_stripe_subscription_unique
  ON rentals(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;