-- Corrige comparação de ano_letivo (integer) com academic_years (text[])
-- Faz cast de s.ano_letivo para text para evitar 42883: integer = text

CREATE OR REPLACE FUNCTION public.populate_contact_list_items_for_list(p_list_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_list RECORD;
BEGIN
  -- Buscar a lista
  SELECT * INTO v_list FROM public.contact_lists WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE NOTICE 'Lista % não encontrada', p_list_id;
    RETURN;
  END IF;

  -- Limpar itens existentes da lista
  DELETE FROM public.contact_list_items WHERE list_id = p_list_id;

  -- Inserir alunos que casam com os filtros
  INSERT INTO public.contact_list_items (list_id, student_id, entered_at)
  SELECT v_list.id, s.id, now()
  FROM public.students s
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE
    (v_list.is_active IS TRUE)
    AND (v_list.status_in IS NULL OR s.status = ANY (v_list.status_in))
    AND (v_list.unit_ids IS NULL OR s.unit_id = ANY (v_list.unit_ids))
    AND (v_list.series_ids IS NULL OR (c.series_id = ANY (v_list.series_ids)))
    AND (v_list.class_ids IS NULL OR s.class_id = ANY (v_list.class_ids))
    AND (v_list.academic_years IS NULL OR s.ano_letivo::text = ANY (v_list.academic_years))
    AND (
      v_list.exam_date_filters IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(v_list.exam_date_filters) AS f(val)
        WHERE CASE
          WHEN f.val = 'sem_data' THEN s.exam_date IS NULL
          WHEN f.val = 'hoje' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) = current_date
          WHEN f.val = 'futuras' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) > current_date
          WHEN f.val = 'passadas' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) < current_date
          WHEN f.val LIKE 'date_%' THEN s.exam_date IS NOT NULL AND public.safe_to_date(s.exam_date::text) = substring(f.val from 6)::date
          ELSE FALSE
        END
      )
    );
END;
$$;

-- Nota: Gatilhhos permanecem os mesmos, apontando para esta função atualizada