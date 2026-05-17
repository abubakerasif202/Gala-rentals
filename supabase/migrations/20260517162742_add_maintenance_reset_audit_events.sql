CREATE TABLE IF NOT EXISTS public.maintenance_reset_audit_events (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  actor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_reset_audit_events_created_at
  ON public.maintenance_reset_audit_events (created_at DESC);

ALTER TABLE public.maintenance_reset_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_full_access ON public.maintenance_reset_audit_events;
CREATE POLICY admin_full_access
  ON public.maintenance_reset_audit_events
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
