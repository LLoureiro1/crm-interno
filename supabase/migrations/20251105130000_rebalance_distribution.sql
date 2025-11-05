-- Rebalanceamento da distribuição de itens entre designados
-- Esta migração substitui a função para redistribuir TODOS os itens da lista
-- em esquema round-robin sempre que houver alteração nos designados,
-- evitando que o primeiro usuário mantenha todos os itens.

CREATE OR REPLACE FUNCTION public.distribute_contact_list_items(p_list_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignees uuid[];
  v_n int;
BEGIN
  -- Coletar os designados da lista na ordem de criação
  SELECT array_agg(user_id ORDER BY created_at, user_id)
  INTO v_assignees
  FROM public.contact_list_assignees
  WHERE list_id = p_list_id;

  v_n := COALESCE(cardinality(v_assignees), 0);
  IF v_n = 0 THEN
    -- Sem designados: remover assignments para evitar concentração indevida
    UPDATE public.contact_list_items
    SET assigned_user_id = NULL
    WHERE list_id = p_list_id;
    RETURN;
  END IF;

  -- Redistribuir TODOS os itens da lista de forma determinística (por entered_at, id)
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY entered_at ASC, id) AS rn
    FROM public.contact_list_items
    WHERE list_id = p_list_id
  )
  UPDATE public.contact_list_items AS cli
  SET assigned_user_id = v_assignees[((ordered.rn - 1) % v_n) + 1]
  FROM ordered
  WHERE cli.id = ordered.id;
END;
$$;