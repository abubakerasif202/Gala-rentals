-- Track privacy lifecycle purges for sensitive application documents.
-- Raw document paths are nulled after purge; this metadata keeps only
-- non-reversible audit evidence needed for disputes, fraud review, rental
-- history, and legal retention.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS documents_purged_at TIMESTAMPTZ;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS document_retention_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_applications_documents_purged_at
  ON public.applications(documents_purged_at);

NOTIFY pgrst, 'reload schema';
