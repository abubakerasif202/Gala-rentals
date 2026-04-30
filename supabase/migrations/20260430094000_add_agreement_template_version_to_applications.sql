alter table public.applications
  add column if not exists agreement_template_version integer;

update public.applications
  set agreement_template_version = coalesce(agreement_template_version, 1)
  where agreement_template_version is null;

alter table public.applications
  alter column agreement_template_version set default 1,
  alter column agreement_template_version set not null;
