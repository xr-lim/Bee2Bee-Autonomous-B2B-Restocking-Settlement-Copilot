ALTER TABLE public.conversation_messages
ADD COLUMN IF NOT EXISTS translated_content TEXT;
