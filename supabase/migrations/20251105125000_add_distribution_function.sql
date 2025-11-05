-- Função para distribuir itens da lista entre designados (round-robin)
-- Atualiza apenas itens sem assigned_user_id

CREATE OR REPLACE FUNCTION public.distribute_contact_list_items(p_list_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignees uuid[];
  v_n int;
BEGIN
  SELECT array_agg(user_id ORDER BY created_at, user_id)
  INTO v_assignees
  FROM public.contact_list_assignees
  WHERE list_id = p_list_id;

  v_n := COALESCE(cardinality(v_assignees), 0);
  IF v_n = 0 THEN
    RAISE NOTICE 'Sem designados para lista %', p_list_id;
    RETURN;
  END IF;

  WITH unassigned AS (
    SELECT id, row_number() OVER (ORDER BY entered_at ASC, id) AS rn
    FROM public.contact_list_items
    WHERE list_id = p_list_id AND assigned_user_id IS NULL
  )
  UPDATE public.contact_list_items AS cli
  SET assigned_user_id = v_assignees[((unassigned.rn - 1) % v_n) + 1]
  FROM unassigned
  WHERE cli.id = unassigned.id;
END;
$$;

-- Atualiza função de população para chamar distribuição ao final
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

  -- Distribuir itens aos designados (se houver)
  PERFORM public.distribute_contact_list_items(p_list_id);
END;
$$;

-- Gatilhos pós mudanças em designados para tentar distribuir novos itens sem assignment
CREATE OR REPLACE FUNCTION public.trg_after_change_assignees_distribute()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_list_id uuid;
BEGIN
  v_list_id := COALESCE(NEW.list_id, OLD.list_id);
  IF v_list_id IS NOT NULL THEN
    PERFORM public.distribute_contact_list_items(v_list_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_list_assignees_after_insert_distribute ON public.contact_list_assignees;
CREATE TRIGGER trg_contact_list_assignees_after_insert_distribute
AFTER INSERT ON public.contact_list_assignees
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_change_assignees_distribute();

DROP TRIGGER IF EXISTS trg_contact_list_assignees_after_delete_distribute ON public.contact_list_assignees;
CREATE TRIGGER trg_contact_list_assignees_after_delete_distribute
AFTER DELETE ON public.contact_list_assignees
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_change_assignees_distribute();