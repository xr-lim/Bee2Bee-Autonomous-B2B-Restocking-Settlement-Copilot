ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_telegram_chat_id_idx
ON public.suppliers (telegram_chat_id)
WHERE telegram_chat_id IS NOT NULL;
