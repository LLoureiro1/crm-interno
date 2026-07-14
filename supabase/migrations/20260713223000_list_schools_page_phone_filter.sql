-- Filtro de telefone em list_schools_page (espelha p_email_filter)

CREATE OR REPLACE FUNCTION public.list_schools_page(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_ano_letivo integer[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_exclude_status text DEFAULT 'cadastro_invalido',
  p_unit_ids uuid[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort_asc boolean DEFAULT false,
  p_email_filter text DEFAULT NULL,
  p_phone_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_full_access boolean := false;
  v_allowed uuid[] := ARRAY[]::uuid[];
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT
    (
      p.profile = 'admin'::public.user_profile
      OR u.slug = 'central'
    ),
    COALESCE(
      (
        SELECT array_agg(DISTINCT x)
        FROM (
          SELECT pu.unit_id AS x
          FROM public.profile_units pu
          WHERE pu.profile_id = p.id
          UNION
          SELECT p.unit_id
          WHERE p.unit_id IS NOT NULL
        ) s
      ),
      ARRAY[]::uuid[]
    )
  INTO v_full_access, v_allowed
  FROM public.profiles p
  LEFT JOIN public.units u ON u.id = p.unit_id
  WHERE p.id = v_uid
    AND p.ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile inactive or missing';
  END IF;

  IF p_unit_ids IS NOT NULL AND cardinality(p_unit_ids) > 0 THEN
    IF v_full_access THEN
      v_allowed := p_unit_ids;
    ELSE
      SELECT COALESCE(array_agg(x), ARRAY[]::uuid[])
      INTO v_allowed
      FROM unnest(v_allowed) AS x
      WHERE x = ANY (p_unit_ids);
    END IF;
    v_full_access := false;
  END IF;

  IF NOT v_full_access AND (v_allowed IS NULL OR cardinality(v_allowed) = 0) THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total', 0);
  END IF;

  WITH base AS (
    SELECT
      s.id,
      s.student_name,
      s.inep_code,
      s.estado,
      s.city_code,
      s.city,
      s.email,
      s.phone,
      s.status,
      s.tag,
      s.code,
      s.unit_id,
      s.ano_letivo,
      s.infantil_count,
      s.ef1_count,
      s.ef2_count,
      s.medio_count,
      s.total_students_count,
      s.engagement_score,
      s.created_at,
      s.updated_at,
      s.responsible_name,
      jsonb_build_object('id', un.id, 'name', un.name) AS units
    FROM public.students s
    LEFT JOIN public.units un ON un.id = s.unit_id
    WHERE (v_full_access OR s.unit_id = ANY (v_allowed))
      AND (p_ano_letivo IS NULL OR cardinality(p_ano_letivo) = 0 OR s.ano_letivo = ANY (p_ano_letivo))
      AND (
        CASE
          WHEN p_statuses IS NOT NULL AND cardinality(p_statuses) > 0
            THEN s.status::text = ANY (p_statuses)
          ELSE (
            p_exclude_status IS NULL
            OR s.status::text IS DISTINCT FROM p_exclude_status
          )
        END
      )
      AND (
        v_search IS NULL
        OR s.student_name ILIKE '%' || v_search || '%'
        OR COALESCE(s.inep_code, '') ILIKE '%' || v_search || '%'
        OR COALESCE(s.code, '') ILIKE '%' || v_search || '%'
        OR COALESCE(s.city, '') ILIKE '%' || v_search || '%'
        OR COALESCE(s.estado, '') ILIKE '%' || v_search || '%'
      )
      AND (
        p_email_filter IS NULL
        OR (
          p_email_filter = 'sem_email'
          AND (s.email IS NULL OR btrim(s.email) = '')
        )
        OR (
          p_email_filter = 'com_email'
          AND s.email IS NOT NULL
          AND btrim(s.email) <> ''
        )
      )
      AND (
        p_phone_filter IS NULL
        OR (
          p_phone_filter = 'sem_telefone'
          AND (s.phone IS NULL OR btrim(s.phone) = '')
        )
        OR (
          p_phone_filter = 'com_telefone'
          AND s.phone IS NOT NULL
          AND btrim(s.phone) <> ''
        )
      )
  ),
  numbered AS (
    SELECT
      b.*,
      count(*) OVER () AS _total
    FROM base b
  ),
  page AS (
    SELECT *
    FROM numbered
    ORDER BY
      CASE WHEN p_sort_asc THEN created_at END ASC NULLS LAST,
      CASE WHEN NOT p_sort_asc THEN created_at END DESC NULLS LAST
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total', COALESCE((SELECT _total FROM page LIMIT 1), (SELECT count(*) FROM base), 0),
    'items', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(p) - '_total')
        FROM page p
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_schools_page(integer, integer, integer[], text[], text, uuid[], text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_schools_page(integer, integer, integer[], text[], text, uuid[], text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_schools_page(integer, integer, integer[], text[], text, uuid[], text, boolean, text, text) TO authenticated, service_role;
