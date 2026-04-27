-- Add Stripe tracking IDs to rentals and bookings
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

-- Create an index for faster lookups during webhooks
CREATE INDEX IF NOT EXISTS idx_rentals_stripe_subscription ON rentals("stripeSubscriptionId");
;
