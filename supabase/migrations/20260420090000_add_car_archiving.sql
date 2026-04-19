alter table cars
  add column if not exists archived_at timestamptz;

create index if not exists idx_cars_archived_at on cars (archived_at);
