create table if not exists manual_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'overdue', 'cancelled')),
  issue_date date not null,
  due_date date,
  bill_to_name text not null,
  bill_to_abn_mobile text,
  vehicle_reference text,
  rental_period_reference text,
  notes text,
  additional_details text,
  subtotal numeric(12, 2) not null default 0,
  gst numeric(12, 2) not null default 0,
  total_inc_gst numeric(12, 2) not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manual_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references manual_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  gst numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  sort_order integer not null default 0
);

create index if not exists idx_manual_invoices_created_at
  on manual_invoices(created_at desc);

create index if not exists idx_manual_invoice_items_invoice_id
  on manual_invoice_items(invoice_id, sort_order);
