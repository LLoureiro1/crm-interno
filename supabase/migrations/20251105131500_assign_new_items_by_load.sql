-- Atribui automaticamente designados aos novos itens da lista com base na menor carga ativa

-- Atualiza a função de sincronização para atribuir assigned_user_id
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

  -- 1.b) Atribuir designado ao novo item, escolhendo o usuário com menor carga ativa na lista
  -- (considera apenas itens com left_at IS NULL)
  UPDATE public.contact_list_items cli
  SET assigned_user_id = chosen.user_id
  FROM (
    SELECT cli2.id AS item_id,
           (
             SELECT a.user_id
             FROM public.contact_list_assignees a
             WHERE a.list_id = cli2.list_id
             ORDER BY (
               SELECT COUNT(1)
               FROM public.contact_list_items i
               WHERE i.list_id = cli2.list_id AND i.assigned_user_id = a.user_id AND i.left_at IS NULL
             ) ASC,
             a.created_at ASC,
             a.user_id ASC
             LIMIT 1
           ) AS user_id
    FROM public.contact_list_items cli2
    WHERE cli2.student_id = p_student_id AND cli2.left_at IS NULL AND cli2.assigned_user_id IS NULL
  ) AS chosen
  WHERE cli.id = chosen.item_id AND chosen.user_id IS NOT NULL;

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
END;
$$;