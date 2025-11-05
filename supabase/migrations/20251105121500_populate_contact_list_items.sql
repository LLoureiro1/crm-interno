-- Função e gatilhos para popular itens de listas de contato conforme filtros

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
  INSERT INTO public.contact_list_items (list_id, student_id, entered_at, created_at)
  SELECT v_list.id, s.id, now(), now()
  FROM public.students s
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE
    (v_list.is_active IS TRUE)
    AND (v_list.status_in IS NULL OR s.status = ANY (v_list.status_in))
    AND (v_list.unit_ids IS NULL OR s.unit_id = ANY (v_list.unit_ids))
    AND (v_list.series_ids IS NULL OR (c.series_id = ANY (v_list.series_ids)))
    AND (v_list.class_ids IS NULL OR s.class_id = ANY (v_list.class_ids))
    AND (v_list.academic_years IS NULL OR s.ano_letivo = ANY (v_list.academic_years))
    AND (
      v_list.exam_date_filters IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(v_list.exam_date_filters) AS f(val)
        WHERE CASE
          WHEN f.val = 'sem_data' THEN s.exam_date IS NULL
          WHEN f.val = 'hoje' THEN s.exam_date IS NOT NULL AND to_char(to_date(s.exam_date::text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = to_char(current_date, 'YYYY-MM-DD')
          WHEN f.val = 'futuras' THEN s.exam_date IS NOT NULL AND to_date(s.exam_date::text, 'YYYY-MM-DD') > current_date
          WHEN f.val = 'passadas' THEN s.exam_date IS NOT NULL AND to_date(s.exam_date::text, 'YYYY-MM-DD') < current_date
          WHEN f.val LIKE 'date_%' THEN s.exam_date IS NOT NULL AND to_char(to_date(s.exam_date::text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = substring(f.val from 6)
          ELSE FALSE
        END
      )
    );
END;
$$;

-- Gatilho pós INSERT para popular itens ao criar lista
CREATE OR REPLACE FUNCTION public.trg_after_insert_contact_lists_populate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.populate_contact_list_items_for_list(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_lists_after_insert_populate ON public.contact_lists;
CREATE TRIGGER trg_contact_lists_after_insert_populate
AFTER INSERT ON public.contact_lists
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_insert_contact_lists_populate();

-- Gatilho pós UPDATE dos campos de filtro para repopular itens
CREATE OR REPLACE FUNCTION public.trg_after_update_contact_lists_repopulate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Repopular apenas se campos de filtro forem alterados ou ativação mudar
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.status_in IS DISTINCT FROM OLD.status_in
       OR NEW.unit_ids IS DISTINCT FROM OLD.unit_ids
       OR NEW.series_ids IS DISTINCT FROM OLD.series_ids
       OR NEW.class_ids IS DISTINCT FROM OLD.class_ids
       OR NEW.academic_years IS DISTINCT FROM OLD.academic_years
       OR NEW.exam_date_filters IS DISTINCT FROM OLD.exam_date_filters THEN
      PERFORM public.populate_contact_list_items_for_list(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_lists_after_update_repopulate ON public.contact_lists;
CREATE TRIGGER trg_contact_lists_after_update_repopulate
AFTER UPDATE ON public.contact_lists
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_update_contact_lists_repopulate();