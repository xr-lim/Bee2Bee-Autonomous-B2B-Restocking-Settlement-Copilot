-- Autonomous B2B Restocking & Settlement Copilot domain schema
--
-- This schema intentionally removes legacy presentation storage from the
-- hackathon demo database. The removed objects held chart/card payloads,
-- duplicated SKU/supplier text, and old UI workflow summaries.

drop table if exists public.app_config cascade;
drop table if exists public.restock_recommendations cascade;
drop table if exists public.negotiation_messages cascade;

drop table if exists public.invoice_actions cascade;
drop table if exists public.invoice_validation_results cascade;
drop table if exists public.invoice_products cascade;
drop table if exists public.invoices cascade;
drop table if exists public.workflow_events cascade;
drop table if exists public.restock_requests cascade;
drop table if exists public.workflows cascade;
drop table if exists public.conversation_messages cascade;
drop table if exists public.conversation_products cascade;
drop table if exists public.conversations cascade;
drop table if exists public.threshold_change_requests cascade;
drop table if exists public.product_stock_demand_trends cascade;
drop table if exists public.product_suppliers cascade;
drop table if exists public.products cascade;
drop table if exists public.suppliers cascade;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.suppliers (
  id text primary key,
  name text not null,
  region text not null,
  lead_time_days integer not null check (lead_time_days >= 0),
  reliability_score numeric(5, 2) not null check (
    reliability_score >= 0 and reliability_score <= 100
  ),
  moq integer check (moq is null or moq >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  sku text not null unique,
  name text not null,
  category text not null,
  current_stock integer not null check (current_stock >= 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  current_threshold integer not null check (current_threshold >= 0),
  max_capacity integer not null check (max_capacity >= 0),
  status text not null check (
    status in (
      'healthy',
      'near_threshold',
      'below_threshold',
      'batch_candidate'
    )
  ),
  primary_supplier_id text references public.suppliers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_stock_demand_trends (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  month_order integer not null check (month_order between 1 and 12),
  month text not null,
  stock integer not null check (stock >= 0),
  demand integer not null check (demand >= 0),
  promotion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, month_order)
);

create table public.product_suppliers (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);

create table public.threshold_change_requests (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  old_threshold integer not null check (old_threshold >= 0),
  proposed_threshold integer not null check (proposed_threshold >= 0),
  reason_type text not null,
  reason_summary text not null,
  status text not null check (
    status in ('pending', 'reviewed', 'approved', 'rejected')
  ),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id text primary key,
  supplier_id text references public.suppliers(id) on delete set null,
  title text not null,
  source text not null check (
    source in (
      'email',
      'whatsapp',
      'telegram',
      'wechat',
      'pdf',
      'image',
      'voice_note'
    )
  ),
  state text not null check (
    state in (
      'new_input',
      'needs_analysis',
      'counter_offer',
      'waiting_reply',
      'accepted',
      'escalated',
      'closed'
    )
  ),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  latest_message text,
  linked_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_products (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  unique (conversation_id, product_id)
);

create table public.conversation_messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_type text not null check (
    sender_type in ('merchant', 'supplier', 'ai', 'system')
  ),
  message_type text not null check (
    message_type in ('text', 'email', 'whatsapp', 'telegram', 'wechat', 'pdf', 'image', 'voice_note')
  ),
  content text not null,
  attachment_url text,
  extracted_price numeric(12, 2),
  extracted_quantity integer check (
    extracted_quantity is null or extracted_quantity >= 0
  ),
  detected_intent text,
  missing_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table public.workflows (
  id text primary key,
  product_id text references public.products(id) on delete set null,
  current_state text not null check (
    current_state in (
      'stock_healthy',
      'threshold_review',
      'supplier_prep',
      'po_sent',
      'waiting_supplier',
      'invoice_processing',
      'ready_for_approval',
      'completed',
      'escalated',
      'blocked'
    )
  ),
  target_price_min numeric(12, 2),
  target_price_max numeric(12, 2),
  quantity integer check (quantity is null or quantity >= 0),
  conversation_id text references public.conversations(id) on delete set null,
  invoice_id text,
  approval_state text not null check (
    approval_state in ('waiting_approval', 'needs_review', 'blocked', 'completed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restock_requests (
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

create table public.workflow_events (
  id text primary key,
  workflow_id text not null references public.workflows(id) on delete cascade,
  state text not null check (
    state in (
      'stock_healthy',
      'threshold_review',
      'supplier_prep',
      'po_sent',
      'waiting_supplier',
      'invoice_processing',
      'ready_for_approval',
      'completed',
      'escalated',
      'blocked'
    )
  ),
  note text not null,
  actor_type text not null check (
    actor_type in ('merchant', 'supplier', 'ai', 'system', 'finance')
  ),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id text primary key,
  invoice_number text not null unique,
  supplier_id text references public.suppliers(id) on delete set null,
  workflow_id text references public.workflows(id) on delete set null,
  source_type text not null check (
    source_type in ('pdf', 'image', 'email_attachment', 'upload')
  ),
  file_url text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (currency in ('USD', 'MYR', 'SGD')),
  quantity integer check (quantity is null or quantity >= 0),
  payment_terms text,
  bank_details text,
  validation_status text not null check (
    validation_status in (
      'parsed',
      'validated',
      'mismatch_detected',
      'missing_information'
    )
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  approval_state text not null check (
    approval_state in ('waiting_approval', 'needs_review', 'blocked', 'completed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add constraint conversations_linked_invoice_id_fkey
  foreign key (linked_invoice_id)
  references public.invoices(id)
  on delete set null
  deferrable initially deferred;

alter table public.workflows
  add constraint workflows_invoice_id_fkey
  foreign key (invoice_id)
  references public.invoices(id)
  on delete set null
  deferrable initially deferred;

create table public.invoice_products (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity >= 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  unique (invoice_id, product_id)
);

create table public.invoice_validation_results (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  check_name text not null,
  expected_value text,
  actual_value text,
  result text not null check (result in ('passed', 'warning', 'failed')),
  created_at timestamptz not null default now()
);

create table public.invoice_actions (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  action_type text not null,
  note text not null,
  actor_type text not null check (
    actor_type in ('merchant', 'supplier', 'ai', 'system', 'finance')
  ),
  created_at timestamptz not null default now()
);

create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger set_product_stock_demand_trends_updated_at
before update on public.product_stock_demand_trends
for each row execute function public.set_updated_at();

create trigger set_threshold_change_requests_updated_at
before update on public.threshold_change_requests
for each row execute function public.set_updated_at();

create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create trigger set_workflows_updated_at
before update on public.workflows
for each row execute function public.set_updated_at();

create trigger set_restock_requests_updated_at
before update on public.restock_requests
for each row execute function public.set_updated_at();

create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create index idx_products_primary_supplier_id
  on public.products (primary_supplier_id);
create index idx_product_stock_demand_trends_product_id
  on public.product_stock_demand_trends (product_id);
create index idx_product_suppliers_product_id
  on public.product_suppliers (product_id);
create index idx_product_suppliers_supplier_id
  on public.product_suppliers (supplier_id);
create index idx_threshold_change_requests_product_id
  on public.threshold_change_requests (product_id);
create index idx_conversations_supplier_id
  on public.conversations (supplier_id);
create index idx_conversation_products_conversation_id
  on public.conversation_products (conversation_id);
create index idx_conversation_products_product_id
  on public.conversation_products (product_id);
create index idx_conversation_messages_conversation_id
  on public.conversation_messages (conversation_id);
create index idx_workflows_product_id
  on public.workflows (product_id);
create index idx_workflows_conversation_id
  on public.workflows (conversation_id);
create index idx_restock_requests_product_id
  on public.restock_requests (product_id);
create index idx_restock_requests_workflow_id
  on public.restock_requests (workflow_id);
create index idx_restock_requests_status
  on public.restock_requests (status);
create index idx_invoices_supplier_id
  on public.invoices (supplier_id);
create index idx_invoices_workflow_id
  on public.invoices (workflow_id);
create index idx_invoice_products_invoice_id
  on public.invoice_products (invoice_id);
create index idx_invoice_products_product_id
  on public.invoice_products (product_id);
create index idx_invoice_validation_results_invoice_id
  on public.invoice_validation_results (invoice_id);
create index idx_invoice_actions_invoice_id
  on public.invoice_actions (invoice_id);
