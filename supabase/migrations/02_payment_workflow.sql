-- Add payment workflow columns to camel-case schemas used by the live Supabase project.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS "assignedCarId" BIGINT REFERENCES cars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "approvedBond" NUMERIC CHECK ("approvedBond" >= 0),
  ADD COLUMN IF NOT EXISTS "approvedWeeklyPrice" NUMERIC CHECK ("approvedWeeklyPrice" >= 0),
  ADD COLUMN IF NOT EXISTS "paymentLinkVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentLinkSentAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pendingCheckoutSessionId" TEXT;

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_assigned_car_id
  ON applications("assignedCarId");

DROP INDEX IF EXISTS idx_applications_active_vehicle_allocation_unique;

CREATE UNIQUE INDEX idx_applications_active_vehicle_allocation_unique
  ON applications("assignedCarId")
  WHERE "assignedCarId" IS NOT NULL
    AND lower(status) IN ('approved', 'payment review');

CREATE INDEX IF NOT EXISTS idx_rentals_car_id
  ON rentals("carId");

CREATE INDEX IF NOT EXISTS idx_rentals_application_id
  ON rentals("applicationId");

CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_live_car_unique
  ON rentals("carId")
  WHERE lower(status) IN ('active', 'overdue');

CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_live_application_unique
  ON rentals("applicationId")
  WHERE lower(status) IN ('active', 'overdue');

CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_stripe_subscription_unique
  ON rentals("stripeSubscriptionId")
  WHERE "stripeSubscriptionId" IS NOT NULL;
