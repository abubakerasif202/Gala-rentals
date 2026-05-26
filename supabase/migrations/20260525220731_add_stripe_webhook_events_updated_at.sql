-- Track the last webhook ledger mutation separately from first receipt time.
-- Stale processing reclaim uses updated_at so received_at remains the audit
-- timestamp for when Stripe first delivered the event.

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.stripe_webhook_events
SET updated_at = COALESCE(updated_at, processed_at, received_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status_updated_at
  ON public.stripe_webhook_events(status, updated_at);

NOTIFY pgrst, 'reload schema';
