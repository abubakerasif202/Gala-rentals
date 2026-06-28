-- Durable queue storage for short-transaction background job claiming.
-- Job payload processing happens in a separate worker after the claim commits.

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL DEFAULT 'default',
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT background_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT background_jobs_attempts_check CHECK (attempts >= 0),
  CONSTRAINT background_jobs_max_attempts_check CHECK (max_attempts > 0)
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_pending_dequeue
  ON public.background_jobs(queue_name, run_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_background_jobs_stuck_processing
  ON public.background_jobs(locked_until)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_background_jobs_job_type_status
  ON public.background_jobs(job_type, status);

ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.background_jobs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.background_jobs TO service_role;

NOTIFY pgrst, 'reload schema';
