ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS approved_vehicle TEXT;
