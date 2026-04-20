-- Core entity tables
create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  region text not null,
  reliability_score numeric not null,
  lead_time_days integer not null,
  status text not null
);

alter table public.suppliers add column if not exists name text;
alter table public.suppliers add column if not exists region text;
alter table public.suppliers add column if not exists reliability_score numeric;
alter table public.suppliers add column if not exists lead_time_days integer;
alter table public.suppliers add column if not exists status text;

create table if not exists public.products (
  id text primary key,
  sku text unique not null,
  name text not null,
  category text not null,
  stock_on_hand integer not null,
  reorder_point integer not null,
  static_threshold integer not null,
  ai_threshold integer not null,
  unit_cost numeric not null,
  max_stock_amount integer not null,
  forecast_demand integer not null,
  monthly_velocity integer not null,
  trend_30d integer not null,
  trend_365d integer not null,
  supplier_id text not null,
  conversation_id text,
  invoice_id text,
  status text not null,
  suppliers jsonb,
  pending_ai_analysis boolean default false
);

alter table public.products add column if not exists sku text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists stock_on_hand integer;
alter table public.products add column if not exists reorder_point integer;
alter table public.products add column if not exists static_threshold integer;
alter table public.products add column if not exists ai_threshold integer;
alter table public.products add column if not exists unit_cost numeric;
alter table public.products add column if not exists max_stock_amount integer;
alter table public.products add column if not exists forecast_demand integer;
alter table public.products add column if not exists monthly_velocity integer;
alter table public.products add column if not exists trend_30d integer;
alter table public.products add column if not exists trend_365d integer;
alter table public.products add column if not exists supplier_id text;
alter table public.products add column if not exists conversation_id text;
alter table public.products add column if not exists invoice_id text;
alter table public.products add column if not exists status text;
alter table public.products add column if not exists suppliers jsonb;
alter table public.products add column if not exists pending_ai_analysis boolean default false;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_sku_unique'
  ) then
    alter table public.products add constraint products_sku_unique unique (sku);
  end if;
exception when others then
  null;
end $$;

create table if not exists public.conversations (
  id text primary key,
  product_sku text not null,
  linked_skus text[] not null,
  supplier_id text not null,
  subject text not null,
  source text not null,
  negotiation_state text not null,
  latest_message text not null,
  target_price_range text not null,
  created_date timestamptz not null,
  priority text not null,
  last_message_at timestamptz not null,
  status text not null,
  ai_extraction jsonb not null,
  next_action jsonb not null
);

alter table public.conversations add column if not exists product_sku text;
alter table public.conversations add column if not exists linked_skus text[];
alter table public.conversations add column if not exists supplier_id text;
alter table public.conversations add column if not exists subject text;
alter table public.conversations add column if not exists source text;
alter table public.conversations add column if not exists negotiation_state text;
alter table public.conversations add column if not exists latest_message text;
alter table public.conversations add column if not exists target_price_range text;
alter table public.conversations add column if not exists created_date timestamptz;
alter table public.conversations add column if not exists priority text;
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists status text;
alter table public.conversations add column if not exists ai_extraction jsonb;
alter table public.conversations add column if not exists next_action jsonb;

create table if not exists public.negotiation_messages (
  id text primary key,
  conversation_id text not null,
  supplier_id text not null,
  type text not null,
  author text not null,
  body text not null,
  sentiment text not null,
  created_at timestamptz not null,
  attachment_type text,
  attachment_label text,
  order_summary jsonb,
  invoice_id text,
  language text,
  translation text
);

alter table public.negotiation_messages add column if not exists conversation_id text;
alter table public.negotiation_messages add column if not exists supplier_id text;
alter table public.negotiation_messages add column if not exists type text;
alter table public.negotiation_messages add column if not exists author text;
alter table public.negotiation_messages add column if not exists body text;
alter table public.negotiation_messages add column if not exists sentiment text;
alter table public.negotiation_messages add column if not exists created_at timestamptz;
alter table public.negotiation_messages add column if not exists attachment_type text;
alter table public.negotiation_messages add column if not exists attachment_label text;
alter table public.negotiation_messages add column if not exists order_summary jsonb;
alter table public.negotiation_messages add column if not exists invoice_id text;
alter table public.negotiation_messages add column if not exists language text;
alter table public.negotiation_messages add column if not exists translation text;

create table if not exists public.invoices (
  id text primary key,
  supplier_id text not null,
  product_sku text not null,
  linked_skus text[] not null,
  workflow_id text not null,
  invoice_number text not null,
  amount numeric not null,
  negotiated_amount numeric not null,
  expected_quantity integer not null,
  invoice_quantity integer not null,
  unit_price numeric not null,
  subtotal numeric not null,
  currency text not null,
  risk text not null,
  risk_level text not null,
  risk_reason text not null,
  validation_status text not null,
  approval_state text not null,
  source_type text not null,
  file_name text not null,
  file_size text not null,
  bank_details text not null,
  payment_terms text not null,
  risk_confidence integer not null,
  flags jsonb not null,
  mismatches text[] not null,
  history jsonb not null,
  notes text not null,
  status text not null,
  due_date date not null,
  last_updated timestamptz not null
);

alter table public.invoices add column if not exists supplier_id text;
alter table public.invoices add column if not exists product_sku text;
alter table public.invoices add column if not exists linked_skus text[];
alter table public.invoices add column if not exists workflow_id text;
alter table public.invoices add column if not exists invoice_number text;
alter table public.invoices add column if not exists amount numeric;
alter table public.invoices add column if not exists negotiated_amount numeric;
alter table public.invoices add column if not exists expected_quantity integer;
alter table public.invoices add column if not exists invoice_quantity integer;
alter table public.invoices add column if not exists unit_price numeric;
alter table public.invoices add column if not exists subtotal numeric;
alter table public.invoices add column if not exists currency text;
alter table public.invoices add column if not exists risk text;
alter table public.invoices add column if not exists risk_level text;
alter table public.invoices add column if not exists risk_reason text;
alter table public.invoices add column if not exists validation_status text;
alter table public.invoices add column if not exists approval_state text;
alter table public.invoices add column if not exists source_type text;
alter table public.invoices add column if not exists file_name text;
alter table public.invoices add column if not exists file_size text;
alter table public.invoices add column if not exists bank_details text;
alter table public.invoices add column if not exists payment_terms text;
alter table public.invoices add column if not exists risk_confidence integer;
alter table public.invoices add column if not exists flags jsonb;
alter table public.invoices add column if not exists mismatches text[];
alter table public.invoices add column if not exists history jsonb;
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists status text;
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists last_updated timestamptz;

create table if not exists public.restock_recommendations (
  id text primary key,
  sku text not null,
  product_name text not null,
  supplier text not null,
  reason text not null,
  current_stock integer not null,
  ai_threshold integer not null,
  target_price text not null,
  quantity integer not null,
  estimated_spend text not null,
  automation_plan text[] not null,
  conversation_id text
);

alter table public.restock_recommendations add column if not exists sku text;
alter table public.restock_recommendations add column if not exists product_name text;
alter table public.restock_recommendations add column if not exists supplier text;
alter table public.restock_recommendations add column if not exists reason text;
alter table public.restock_recommendations add column if not exists current_stock integer;
alter table public.restock_recommendations add column if not exists ai_threshold integer;
alter table public.restock_recommendations add column if not exists target_price text;
alter table public.restock_recommendations add column if not exists quantity integer;
alter table public.restock_recommendations add column if not exists estimated_spend text;
alter table public.restock_recommendations add column if not exists automation_plan text[];
alter table public.restock_recommendations add column if not exists conversation_id text;

create table if not exists public.threshold_change_requests (
  id text primary key,
  product_sku text not null,
  product_name text not null,
  current_threshold integer not null,
  proposed_threshold integer not null,
  change_percent integer not null,
  reason text not null,
  proposed_at timestamptz not null,
  status text not null,
  trigger text not null
);

alter table public.threshold_change_requests add column if not exists product_sku text;
alter table public.threshold_change_requests add column if not exists product_name text;
alter table public.threshold_change_requests add column if not exists current_threshold integer;
alter table public.threshold_change_requests add column if not exists proposed_threshold integer;
alter table public.threshold_change_requests add column if not exists change_percent integer;
alter table public.threshold_change_requests add column if not exists reason text;
alter table public.threshold_change_requests add column if not exists proposed_at timestamptz;
alter table public.threshold_change_requests add column if not exists status text;
alter table public.threshold_change_requests add column if not exists trigger text;

-- Config table for dashboard/chart datasets stored as JSON payloads
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config add column if not exists value jsonb;
alter table public.app_config add column if not exists updated_at timestamptz default now();

create index if not exists idx_products_supplier_id on public.products (supplier_id);
create index if not exists idx_conversations_supplier_id on public.conversations (supplier_id);
create index if not exists idx_messages_conversation_id on public.negotiation_messages (conversation_id);
create index if not exists idx_invoices_supplier_id on public.invoices (supplier_id);
