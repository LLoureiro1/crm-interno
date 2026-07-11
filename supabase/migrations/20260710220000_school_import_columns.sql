-- Colunas de localização para importação de escolas
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS city_code text;

-- Importação em massa: telefone pode vir vazio na planilha
ALTER TABLE public.students ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN phone SET DEFAULT '';
