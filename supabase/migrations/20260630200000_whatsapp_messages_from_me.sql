ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS from_me boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_messages.from_me IS 'true = enviada pelo número conectado; false = recebida do contato';
