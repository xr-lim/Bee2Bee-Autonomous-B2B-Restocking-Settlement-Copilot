alter table public.invoices
  add column if not exists risk_confidence integer check (
    risk_confidence is null or (risk_confidence >= 0 and risk_confidence <= 100)
  ),
  add column if not exists ai_summary text,
  add column if not exists ai_last_analyzed_at timestamptz;
