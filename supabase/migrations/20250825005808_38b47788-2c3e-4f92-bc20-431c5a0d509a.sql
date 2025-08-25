
-- 1) Adicionar coluna de relacionamento no students
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS exam_date_id uuid NULL;

-- 2) Criar FK e índice
ALTER TABLE public.students
ADD CONSTRAINT students_exam_date_id_fkey
FOREIGN KEY (exam_date_id) REFERENCES public.exam_dates(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_exam_date_id
ON public.students (exam_date_id);

-- 3) Ajustar RLS de exam_dates
-- Remover política existente que restringe ALL aos admins, pois bloqueia SELECT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_dates'
      AND policyname = 'Só Admin cria exames'
  ) THEN
    DROP POLICY "Só Admin cria exames" ON public.exam_dates;
  END IF;
END$$;

-- SELECT liberado para usuários autenticados
CREATE POLICY IF NOT EXISTS "Authenticated users can view exam_dates"
ON public.exam_dates
FOR SELECT
USING (true);

-- INSERT/UPDATE/DELETE restritos a admin
CREATE POLICY IF NOT EXISTS "Only admin can insert exam_dates"
ON public.exam_dates
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.profile = 'admin'::user_profile
));

CREATE POLICY IF NOT EXISTS "Only admin can update exam_dates"
ON public.exam_dates
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.profile = 'admin'::user_profile
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.profile = 'admin'::user_profile
));

CREATE POLICY IF NOT EXISTS "Only admin can delete exam_dates"
ON public.exam_dates
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.profile = 'admin'::user_profile
));

-- 4) Função e gatilho: sincronizar students.exam_date ao definir/alterar exam_date_id
CREATE OR REPLACE FUNCTION public.set_student_exam_date_from_fk()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.exam_date_id IS NOT NULL THEN
    SELECT ed.exam_date
    INTO NEW.exam_date
    FROM public.exam_dates ed
    WHERE ed.id = NEW.exam_date_id;
  ELSE
    -- Se exam_date_id foi limpo, não forçamos limpar exam_date para manter compatibilidade
    -- (pode ser ajustado conforme a regra de negócio)
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_set_exam_date_from_fk ON public.students;

CREATE TRIGGER trg_students_set_exam_date_from_fk
BEFORE INSERT OR UPDATE OF exam_date_id ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.set_student_exam_date_from_fk();

-- 5) Função e gatilho: propagar alteração da data em exam_dates para students vinculados
CREATE OR REPLACE FUNCTION public.propagate_exam_date_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.exam_date IS DISTINCT FROM OLD.exam_date THEN
    UPDATE public.students s
    SET exam_date = NEW.exam_date,
        updated_at = now()
    WHERE s.exam_date_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_dates_propagate_to_students ON public.exam_dates;

CREATE TRIGGER trg_exam_dates_propagate_to_students
AFTER UPDATE OF exam_date ON public.exam_dates
FOR EACH ROW
EXECUTE FUNCTION public.propagate_exam_date_change();

-- 6) Backfill: preencher exam_date_id para alunos que já possuam exam_date e unidade
-- Requer correspondência exata de data e unidade
UPDATE public.students s
SET exam_date_id = ed.id
FROM public.exam_dates ed
WHERE s.exam_date_id IS NULL
  AND s.exam_date IS NOT NULL
  AND ed.exam_date = s.exam_date
  AND ed.unit_id = s.unit_id;

