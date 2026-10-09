-- Additive only. Apply to verified staging first; production requires approval.
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL CHECK (hits >= 0),
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limits_reset_at_idx ON public.api_rate_limits (reset_at);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM anon, authenticated;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;
-- No customer or financial records are touched.
-- Rollback: revert function traffic first, then DROP TABLE public.api_rate_limits.
