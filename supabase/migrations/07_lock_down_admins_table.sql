-- Lock down the legacy admins table so it cannot be mutated through anon/authenticated clients.
-- The application now treats ADMIN_EMAIL plus server-side middleware as the source of truth.

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admins FROM anon, authenticated;
