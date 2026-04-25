alter table public.invoices
  add column if not exists processing_status text not null default 'idle'
  check (processing_status in ('idle', 'extracting', 'analyzing'));
