ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS bond_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS bond_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS bond_notes TEXT;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_bond_payment_status_check,
  ADD CONSTRAINT applications_bond_payment_status_check
    CHECK (bond_payment_status IS NULL OR bond_payment_status IN ('to_collect', 'cash_paid', 'already_paid')),
  DROP CONSTRAINT IF EXISTS applications_bond_payment_method_check,
  ADD CONSTRAINT applications_bond_payment_method_check
    CHECK (bond_payment_method IS NULL OR bond_payment_method IN ('cash', 'existing_paid'));

COMMENT ON COLUMN public.applications.approved_bond IS
  'Agreement/admin-only bond amount. Never included in Stripe charges.';
