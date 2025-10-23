-- Adicionar coluna tracking_code para rastreamento de origem dos cadastros
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS tracking_code TEXT;

-- Adicionar comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.students.tracking_code IS 'Código de rastreamento para identificar a origem do cadastro (ex: promotor, campanha, etc.)';

-- Criar índice para melhor performance em consultas de rastreamento
CREATE INDEX IF NOT EXISTS idx_students_tracking_code ON public.students(tracking_code);