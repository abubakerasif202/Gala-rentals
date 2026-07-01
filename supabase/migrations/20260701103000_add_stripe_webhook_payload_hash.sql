-- Store a SHA-256 hash of the verified raw Stripe webhook body.
-- This lets duplicate-event handling detect impossible same-event-id payload
-- mismatches without storing full Stripe payloads or sensitive payment data.

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_payload_hash
  ON public.stripe_webhook_events(payload_hash);

NOTIFY pgrst, 'reload schema';
