-- Store non-sensitive worker output metadata, such as private storage object paths.
-- Signed URLs and document contents must not be written to this column.

ALTER TABLE public.background_jobs
  ADD COLUMN IF NOT EXISTS result JSONB;

NOTIFY pgrst, 'reload schema';
