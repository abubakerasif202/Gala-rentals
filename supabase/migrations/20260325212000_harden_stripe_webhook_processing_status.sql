-- Add an explicit in-flight ledger status for Stripe webhook processing.
-- This supports atomic claim/finalize semantics and stale-claim recovery.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_webhook_events'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.stripe_webhook_events
      DROP CONSTRAINT IF EXISTS stripe_webhook_events_status_check;

    ALTER TABLE public.stripe_webhook_events
      ADD CONSTRAINT stripe_webhook_events_status_check
      CHECK (status IN ('received', 'processing', 'processed', 'failed'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
