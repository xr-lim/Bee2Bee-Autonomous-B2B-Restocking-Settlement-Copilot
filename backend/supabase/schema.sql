-- Core entity tables
create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  region text not null,
  reliability_score numeric not null,
  lead_time_days integer not null,
  status text not null
);

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

-- Config table for dashboard/chart datasets stored as JSON payloads
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_supplier_id on public.products (supplier_id);
create index if not exists idx_conversations_supplier_id on public.conversations (supplier_id);
create index if not exists idx_messages_conversation_id on public.negotiation_messages (conversation_id);
create index if not exists idx_invoices_supplier_id on public.invoices (supplier_id);
