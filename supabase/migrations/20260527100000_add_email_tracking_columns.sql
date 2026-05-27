-- Adicionar colunas de tracking na fila de e-mails
ALTER TABLE public.email_queue 
ADD COLUMN IF NOT EXISTS opened_at timestamptz,
ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0;

-- Criar índice para performance de consultas de tracking
CREATE INDEX IF NOT EXISTS email_queue_opened_at_idx ON public.email_queue (opened_at) WHERE opened_at IS NOT NULL;

-- Função para incremento atômico de abertura de e-mail
CREATE OR REPLACE FUNCTION public.increment_email_open(email_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.email_queue
  SET 
    opened_at = COALESCE(opened_at, now()),
    opened_count = opened_count + 1
  WHERE id = email_id;
END;
$$;
