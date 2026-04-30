alter table public.applications
  add column if not exists passport_or_uber_profile_screenshot text,
  add column if not exists agreement_accepted_at timestamptz,
  add column if not exists agreement_signature text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;
