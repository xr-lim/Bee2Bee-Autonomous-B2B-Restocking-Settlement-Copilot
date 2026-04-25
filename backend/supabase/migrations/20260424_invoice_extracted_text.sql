alter table public.invoices
  add column if not exists extracted_text text;
