-- Corrige parsing seguro de exam_date na função de popular itens de listas
-- Adiciona helper safe_to_date para evitar exceptions quando exam_date não está em YYYY-MM-DD

-- Helper para converter texto em date apenas se estiver no formato esperado
CREATE OR REPLACE FUNCTION public.safe_to_date(value TEXT)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    WHEN value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN to_date(value, 'YYYY-MM-DD')
    ELSE NULL
  END;
$$;

-- Atualiza a função para usar parsing seguro nas comparações de exam_date
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

-- Recria os gatilhos para garantir que usem a função atualizada
DROP TRIGGER IF EXISTS trg_contact_lists_after_insert_populate ON public.contact_lists;
CREATE TRIGGER trg_contact_lists_after_insert_populate
AFTER INSERT ON public.contact_lists
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_insert_contact_lists_populate();

DROP TRIGGER IF EXISTS trg_contact_lists_after_update_repopulate ON public.contact_lists;
CREATE TRIGGER trg_contact_lists_after_update_repopulate
AFTER UPDATE ON public.contact_lists
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_update_contact_lists_repopulate();