-- Adds DB-backed restock requests and migrates the product threshold model to
-- a single current_threshold column.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.products
  add column if not exists current_threshold integer;

update public.products
set current_threshold = coalesce(ai_threshold, static_threshold, current_threshold, 0)
where current_threshold is null;

alter table public.products
  alter column current_threshold set not null;

alter table public.products
  drop constraint if exists products_current_threshold_check;

alter table public.products
  add constraint products_current_threshold_check
  check (current_threshold >= 0);

alter table public.products
  drop column if exists static_threshold,
  drop column if exists ai_threshold,
  drop column if exists threshold_buffer;

create table if not exists public.restock_requests (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  workflow_id text references public.workflows(id) on delete set null,
  requested_threshold integer check (
    requested_threshold is null or requested_threshold >= 0
  ),
  requested_quantity integer check (
    requested_quantity is null or requested_quantity >= 0
  ),
  reason_summary text not null,
  status text not null check (
    status in ('pending', 'reviewed', 'accepted', 'rejected', 'cancelled')
  ),
  requested_by text not null check (
    requested_by in ('ai', 'merchant', 'system')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_restock_requests_updated_at on public.restock_requests;
create trigger set_restock_requests_updated_at
before update on public.restock_requests
for each row execute function public.set_updated_at();

create index if not exists idx_restock_requests_product_id
  on public.restock_requests (product_id);
create index if not exists idx_restock_requests_workflow_id
  on public.restock_requests (workflow_id);
create index if not exists idx_restock_requests_status
  on public.restock_requests (status);
