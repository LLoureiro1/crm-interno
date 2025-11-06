-- Sincroniza itens das listas de contato quando um aluno é inserido ou atualizado

-- Função: para um aluno específico, insere itens em listas ativas que ele passa a casar
-- e marca left_at em itens ativos das listas que ele deixa de casar.
CREATE OR REPLACE FUNCTION public.sync_contact_list_items_for_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Inserir novos itens para listas ativas onde o aluno casa os filtros e ainda não tem item ativo
  INSERT INTO public.contact_list_items (list_id, student_id, entered_at)
  SELECT l.id, s.id, now()
  FROM public.students s
  LEFT JOIN public.classes c ON c.id = s.class_id
  JOIN public.contact_lists l ON TRUE
  WHERE s.id = p_student_id
    AND (l.is_active IS TRUE)
    AND (l.status_in IS NULL OR s.status = ANY (l.status_in))
    AND (l.unit_ids IS NULL OR s.unit_id = ANY (l.unit_ids))
    AND (l.series_ids IS NULL OR (c.series_id = ANY (l.series_ids)))
    AND (l.class_ids IS NULL OR s.class_id = ANY (l.class_ids))
    AND (l.academic_years IS NULL OR s.ano_letivo::text = ANY (l.academic_years))
    AND (
      l.exam_date_filters IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(l.exam_date_filters) AS f(val)
        WHERE CASE
          WHEN f.val = 'sem_data' THEN s.exam_date IS NULL
          WHEN f.val = 'hoje' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) = current_date
          WHEN f.val = 'futuras' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) > current_date
          WHEN f.val = 'passadas' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) < current_date
          WHEN f.val LIKE 'date_%' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) = substring(f.val from 6)::date
          ELSE FALSE
        END
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_list_items cli
      WHERE cli.list_id = l.id AND cli.student_id = s.id AND cli.left_at IS NULL
    );

  -- 2) Marcar saída para itens ativos em listas que o aluno não casa mais
  UPDATE public.contact_list_items cli
  SET left_at = now()
  WHERE cli.student_id = p_student_id
    AND cli.left_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.students s
      LEFT JOIN public.classes c ON c.id = s.class_id
      JOIN public.contact_lists l ON l.id = cli.list_id
      WHERE s.id = p_student_id
        AND (l.is_active IS TRUE)
        AND (l.status_in IS NULL OR s.status = ANY (l.status_in))
        AND (l.unit_ids IS NULL OR s.unit_id = ANY (l.unit_ids))
        AND (l.series_ids IS NULL OR (c.series_id = ANY (l.series_ids)))
        AND (l.class_ids IS NULL OR s.class_id = ANY (l.class_ids))
        AND (l.academic_years IS NULL OR s.ano_letivo::text = ANY (l.academic_years))
        AND (
          l.exam_date_filters IS NULL
          OR EXISTS (
            SELECT 1
            FROM unnest(l.exam_date_filters) AS f(val)
            WHERE CASE
              WHEN f.val = 'sem_data' THEN s.exam_date IS NULL
              WHEN f.val = 'hoje' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) = current_date
              WHEN f.val = 'futuras' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) > current_date
              WHEN f.val = 'passadas' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) < current_date
              WHEN f.val LIKE 'date_%' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) = substring(f.val from 6)::date
              ELSE FALSE
            END
          )
        )
    );

  -- Opcional: redistribuir assignments da lista, se necessário (mantemos fora por performance)
  -- A distribuição pode ser disparada por outro gatilho ao alterar designados.
END;
$$;

-- Gatilho: após INSERT ou UPDATE em students, sincroniza membership nas listas
CREATE OR REPLACE FUNCTION public.trg_students_sync_contact_lists()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_contact_list_items_for_student(COALESCE(NEW.id, OLD.id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_after_change_sync_contact_lists ON public.students;
CREATE TRIGGER trg_students_after_change_sync_contact_lists
AFTER INSERT OR UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.trg_students_sync_contact_lists();

-- Observação:
-- Esta função depende de public.safe_to_date (criada em migração 20251105123000_fix_exam_date_filter_parsing.sql)
-- para comparação segura do campo exam_date.