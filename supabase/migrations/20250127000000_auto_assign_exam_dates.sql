-- Função para atribuir automaticamente exam_date_id ao inserir aluno
CREATE OR REPLACE FUNCTION public.auto_assign_exam_date_to_student()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só atribuir se o aluno está em uma turma que tem exame
  IF EXISTS (
    SELECT 1 FROM public.classes c 
    WHERE c.id = NEW.class_id AND c.has_exam = true
  ) THEN
    -- Buscar a próxima data de exame disponível para a unidade do aluno
    SELECT ed.id INTO NEW.exam_date_id
    FROM public.exam_dates ed
    WHERE ed.unit_id = NEW.unit_id
      AND ed.exam_date >= CURRENT_DATE
    ORDER BY ed.exam_date ASC, ed.exam_time ASC
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para auto-atribuição
DROP TRIGGER IF EXISTS trg_auto_assign_exam_date ON public.students;

CREATE TRIGGER trg_auto_assign_exam_date
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_exam_date_to_student();

-- Backfill para alunos existentes que não têm exam_date_id mas estão em turmas com exame
UPDATE public.students s
SET exam_date_id = (
  SELECT ed.id
  FROM public.exam_dates ed
  WHERE ed.unit_id = s.unit_id
    AND ed.exam_date >= CURRENT_DATE
  ORDER BY ed.exam_date ASC, ed.exam_time ASC
  LIMIT 1
)
WHERE s.exam_date_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.classes c 
    WHERE c.id = s.class_id AND c.has_exam = true
  );
