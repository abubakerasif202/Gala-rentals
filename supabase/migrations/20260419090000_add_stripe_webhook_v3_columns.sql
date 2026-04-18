-- Add Stripe webhook V3 observability fields to the existing ledger table.
-- This keeps the current idempotency ledger while making replay and worker
-- behavior easier to debug without introducing a fake queue table.

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS application_id UUID;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS car_id BIGINT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS checkout_kind TEXT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS payment_link_version BIGINT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS processing_source TEXT NOT NULL DEFAULT 'webhook-route';

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS fulfillment_state TEXT NOT NULL DEFAULT 'processing';

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS retry_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_application_id
  ON public.stripe_webhook_events(application_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_checkout_session_id
  ON public.stripe_webhook_events(checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_fulfillment_state
  ON public.stripe_webhook_events(fulfillment_state);

NOTIFY pgrst, 'reload schema';
