alter table public.manual_invoices enable row level security;
alter table public.manual_invoice_items enable row level security;

revoke all on table public.manual_invoices from anon, authenticated;
revoke all on table public.manual_invoice_items from anon, authenticated;

grant select, insert, update, delete on table public.manual_invoices to service_role;
grant select, insert, update, delete on table public.manual_invoice_items to service_role;
