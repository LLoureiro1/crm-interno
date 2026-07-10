-- Transformação do CRM de Alunos para CRM de Escolas
-- Esta migração remove restrições específicas de alunos e adiciona colunas de escola

-- 1. Tornar os campos específicos de alunos nullable
ALTER TABLE public.students ALTER COLUMN responsible_name DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN neighborhood DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN origin_school DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN birth_date DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN class_id DROP NOT NULL;

-- 2. Adicionar as colunas da escola
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS inep_code text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS infantil_count integer DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS ef1_count integer DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS ef2_count integer DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS medio_count integer DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS total_students_count integer DEFAULT 0;
