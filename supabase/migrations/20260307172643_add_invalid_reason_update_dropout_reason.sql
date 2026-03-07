-- Add 'ja_e_aluno' to existing invalid_reason enum
ALTER TYPE public.invalid_reason ADD VALUE IF NOT EXISTS 'ja_e_aluno';
COMMIT;

-- First replace 'ja_e_aluno' values with NULL or move to invalid_reason
-- We will move existing instances of ja_e_aluno to invalid_reason and set student status to cadastro_invalido
UPDATE public.students 
SET 
  invalid_reason = 'ja_e_aluno'::public.invalid_reason,
  status = 'cadastro_invalido'::public.student_status,
  dropout_reason = NULL
WHERE dropout_reason = 'ja_e_aluno';

-- Recreate dropout_reason enum without ja_e_aluno
-- As PostgreSQL doesn't support removing enum values natively, we must:
-- 1. Rename the old type
-- 2. Create the new type with the desired values
-- 3. Update the column to use the new type
-- 4. Drop the old type

ALTER TYPE public.dropout_reason RENAME TO dropout_reason_old;

CREATE TYPE public.dropout_reason AS ENUM (
  'impossibilidade_contato',
  'mudanca_de_endereco',
  'matriculou_outra_escola',
  'motivos_financeiros',
  'falta_vaga',
  'outro'
);

ALTER TABLE public.students 
ALTER COLUMN dropout_reason TYPE public.dropout_reason 
USING dropout_reason::text::public.dropout_reason;

DROP TYPE public.dropout_reason_old;
