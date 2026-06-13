alter table public.suppliers
  add column if not exists whatsapp_number text;

create index if not exists idx_suppliers_whatsapp_number
  on public.suppliers (whatsapp_number);
