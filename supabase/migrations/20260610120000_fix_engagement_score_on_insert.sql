-- Recalcular score de engajamento na criação do aluno (INSERT)
-- Melhora a visibilidade do engajamento para novos inscritos imediatamente.

CREATE OR REPLACE FUNCTION public.trg_refresh_engagement_from_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for INSERT ou se status/final_grade mudaram
  IF TG_OP = 'INSERT' 
     OR (TG_OP = 'UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.final_grade IS DISTINCT FROM OLD.final_grade)) 
  THEN
    PERFORM public.refresh_student_engagement_score(NEW.id);

    -- Snapshots de feature para ML só fazem sentido no UPDATE para status terminais
    IF TG_OP = 'UPDATE' 
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('matriculado', 'desistente')
    THEN
      PERFORM public.capture_engagement_feature_snapshot(
        NEW.id,
        'terminal',
        NEW.status::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Atualizar o trigger para incluir INSERT
DROP TRIGGER IF EXISTS trg_engagement_students_status ON public.students;
CREATE TRIGGER trg_engagement_students_status
  AFTER INSERT OR UPDATE OF status, final_grade ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_engagement_from_student();
