-- RPC de importação em massa (colunas estado/city_code/phone já existem via 20260710220000)

CREATE OR REPLACE FUNCTION public.import_schools_bulk(
  p_unit_id uuid,
  p_rows jsonb,
  p_ano_letivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano text := COALESCE(NULLIF(trim(p_ano_letivo), ''), to_char(CURRENT_DATE, 'YYYY'));
  v_inserted int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (
    public.auth_user_is_admin()
    OR public.user_has_student_access(p_unit_id)
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF p_unit_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id = p_unit_id) THEN
    RAISE EXCEPTION 'invalid unit_id';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('inserted', 0);
  END IF;

  ALTER TABLE public.students DISABLE TRIGGER USER;

  BEGIN
    INSERT INTO public.students (
      student_name,
      inep_code,
      estado,
      city_code,
      city,
      email,
      phone,
      infantil_count,
      ef1_count,
      ef2_count,
      medio_count,
      total_students_count,
      status,
      unit_id,
      ano_letivo
    )
    SELECT
      NULLIF(trim(r->>'student_name'), ''),
      NULLIF(trim(r->>'inep_code'), ''),
      NULLIF(trim(r->>'estado'), ''),
      NULLIF(trim(r->>'city_code'), ''),
      NULLIF(trim(r->>'city'), ''),
      NULLIF(trim(r->>'email'), ''),
      COALESCE(NULLIF(trim(r->>'phone'), ''), ''),
      NULLIF(regexp_replace(COALESCE(r->>'infantil_count', ''), '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(r->>'ef1_count', ''), '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(r->>'ef2_count', ''), '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(r->>'medio_count', ''), '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(r->>'total_students_count', ''), '[^0-9]', '', 'g'), '')::int,
      'nao_confirmado'::public.student_status,
      p_unit_id,
      v_ano
    FROM jsonb_array_elements(p_rows) AS r
    WHERE NULLIF(trim(r->>'student_name'), '') IS NOT NULL;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  EXCEPTION
    WHEN OTHERS THEN
      ALTER TABLE public.students ENABLE TRIGGER USER;
      RAISE;
  END;

  ALTER TABLE public.students ENABLE TRIGGER USER;

  RETURN jsonb_build_object('inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.import_schools_bulk(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_schools_bulk(uuid, jsonb, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.import_schools_bulk(uuid, jsonb, text) IS
  'Importa escolas em lote; desativa triggers USER durante o INSERT para evitar webhooks.';
