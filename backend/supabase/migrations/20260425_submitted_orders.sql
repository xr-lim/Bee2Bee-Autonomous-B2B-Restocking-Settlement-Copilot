-- Add submitted_orders table for tracking finalized orders
-- This table stores confirmed orders after successful negotiations

create table if not exists public.submitted_orders (
  id text primary key,
  restock_request_id text not null references public.restock_requests(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  final_price numeric(12, 2) not null check (final_price >= 0),
  final_quantity integer not null check (final_quantity >= 0),
  status text not null check (status in ('confirmed', 'shipped', 'delivered', 'cancelled')) default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add order_id to invoices table to link invoices to orders
alter table public.invoices
  add column if not exists order_id text references public.submitted_orders(id) on delete set null;

create trigger set_submitted_orders_updated_at
before update on public.submitted_orders
for each row execute function public.set_updated_at();

create index idx_submitted_orders_restock_request_id
  on public.submitted_orders (restock_request_id);
create index idx_submitted_orders_supplier_id
  on public.submitted_orders (supplier_id);
create index idx_submitted_orders_status
  on public.submitted_orders (status);
create index idx_invoices_order_id
  on public.invoices (order_id);