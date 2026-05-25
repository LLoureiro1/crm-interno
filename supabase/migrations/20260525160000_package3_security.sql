-- Pacote 3: RLS por unidade/perfil, profiles públicos mínimos, rate limit de inscrição

-- =============================================================================
-- 1) Helper: verifica se usuário autenticado pode acessar alunos de uma unidade
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_student_access(p_student_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.units u ON u.id = p.unit_id
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND (
        p.profile = 'admin'::public.user_profile
        OR u.slug = 'central'
        OR (p.unit_id IS NOT NULL AND p.unit_id = p_student_unit_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_student_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_student_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.profile = 'admin'::public.user_profile
  );
$$;

REVOKE ALL ON FUNCTION public.auth_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_is_admin() TO authenticated;

-- =============================================================================
-- 2) students: INSERT / UPDATE / DELETE para equipe autenticada
-- =============================================================================

DROP POLICY IF EXISTS "Students insert for authenticated staff" ON public.students;
DROP POLICY IF EXISTS "Students update by unit and role" ON public.students;
DROP POLICY IF EXISTS "Students delete by unit and role" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can update students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can insert students" ON public.students;

CREATE POLICY "Students insert for authenticated staff"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (public.user_has_student_access(unit_id));

CREATE POLICY "Students update by unit and role"
ON public.students
FOR UPDATE
TO authenticated
USING (public.user_has_student_access(unit_id))
WITH CHECK (public.user_has_student_access(unit_id));

CREATE POLICY "Students delete by unit and role"
ON public.students
FOR DELETE
TO authenticated
USING (
  public.user_has_student_access(unit_id)
  AND public.auth_user_is_admin()
);

-- =============================================================================
-- 3) appointments: UPDATE / DELETE por unidade do aluno
-- =============================================================================

DROP POLICY IF EXISTS "Allow update for authenticated" ON public.appointments;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON public.appointments;
DROP POLICY IF EXISTS "Appointments update by unit and role" ON public.appointments;
DROP POLICY IF EXISTS "Appointments delete by unit and role" ON public.appointments;

CREATE POLICY "Appointments update by unit and role"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.appointments.student_id
      AND public.user_has_student_access(s.unit_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.appointments.student_id
      AND public.user_has_student_access(s.unit_id)
  )
);

CREATE POLICY "Appointments delete by unit and role"
ON public.appointments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.appointments.student_id
      AND public.user_has_student_access(s.unit_id)
  )
);

-- =============================================================================
-- 4) contact_attempts: escopo por unidade do aluno
-- =============================================================================

DROP POLICY IF EXISTS "Allow select for authenticated" ON public.contact_attempts;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.contact_attempts;
DROP POLICY IF EXISTS "Contact attempts select by unit" ON public.contact_attempts;
DROP POLICY IF EXISTS "Contact attempts insert by unit" ON public.contact_attempts;

CREATE POLICY "Contact attempts select by unit"
ON public.contact_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.contact_attempts.student_id
      AND public.user_has_student_access(s.unit_id)
  )
);

CREATE POLICY "Contact attempts insert by unit"
ON public.contact_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  attempted_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.contact_attempts.student_id
      AND public.user_has_student_access(s.unit_id)
  )
);

-- =============================================================================
-- 5) profiles: remover acesso anon; view pública só com id + nome
-- =============================================================================

DROP POLICY IF EXISTS "Allow select for all users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select for authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select own or staff" ON public.profiles;

CREATE POLICY "Profiles select for authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR ativo = true
  OR public.auth_user_is_admin()
);

DROP VIEW IF EXISTS public.public_interviewer_profiles;

CREATE VIEW public.public_interviewer_profiles
AS
SELECT id, name
FROM public.profiles
WHERE ativo = true
  AND profile IN (
    'entrevistador'::public.user_profile,
    'direcao'::public.user_profile,
    'admin'::public.user_profile
  );

GRANT SELECT ON public.public_interviewer_profiles TO anon, authenticated;

-- =============================================================================
-- 6) Rate limit de inscrição pública + honeypot
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.registration_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip inet NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_rate_limits_ip_created
ON public.registration_rate_limits (client_ip, created_at DESC);

ALTER TABLE public.registration_rate_limits ENABLE ROW LEVEL SECURITY;

-- Sem policies: tabela acessível apenas via SECURITY DEFINER (register_student)

CREATE OR REPLACE FUNCTION public.register_student(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_student_id uuid;
  v_additional_phones jsonb;
  v_phone text;
  v_ip_raw text;
  v_ip inet;
  v_recent_count integer;
BEGIN
  -- Honeypot anti-bot: campo oculto deve permanecer vazio
  IF COALESCE(trim(p_payload->>'website'), '') <> '' THEN
    RETURN jsonb_build_object(
      'success', true,
      'id', gen_random_uuid(),
      'registration_token', gen_random_uuid()
    );
  END IF;

  IF p_payload IS NULL OR p_payload->>'student_name' IS NULL OR p_payload->>'class_id' IS NULL OR p_payload->>'unit_id' IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados obrigatórios ausentes');
  END IF;

  -- Rate limit por IP (15 inscrições/hora)
  BEGIN
    v_ip_raw := COALESCE(
      nullif(trim(split_part(
        COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1
      )), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'x-real-ip'), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'cf-connecting-ip'), '')
    );

    IF v_ip_raw IS NOT NULL THEN
      v_ip := v_ip_raw::inet;

      SELECT count(*)::integer INTO v_recent_count
      FROM public.registration_rate_limits
      WHERE client_ip = v_ip
        AND created_at > now() - interval '1 hour';

      IF v_recent_count >= 15 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Muitas inscrições em pouco tempo. Tente novamente mais tarde.'
        );
      END IF;

      INSERT INTO public.registration_rate_limits (client_ip) VALUES (v_ip);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  v_additional_phones := COALESCE(p_payload->'additional_phones', '[]'::jsonb);

  INSERT INTO public.students (
    student_name,
    responsible_name,
    birth_date,
    phone,
    email,
    city,
    neighborhood,
    origin_school,
    class_id,
    unit_id,
    registration_source_id,
    tracking_code,
    status,
    exam_date_id,
    exam_date,
    registration_token
  ) VALUES (
    p_payload->>'student_name',
    p_payload->>'responsible_name',
    CASE
      WHEN COALESCE(p_payload->>'birth_date', '') = '' THEN NULL
      ELSE (p_payload->>'birth_date')::date
    END,
    p_payload->>'phone',
    p_payload->>'email',
    NULLIF(p_payload->>'city', ''),
    p_payload->>'neighborhood',
    COALESCE(p_payload->>'origin_school', ''),
    (p_payload->>'class_id')::uuid,
    (p_payload->>'unit_id')::uuid,
    CASE
      WHEN COALESCE(p_payload->>'registration_source_id', '') = '' THEN NULL
      ELSE (p_payload->>'registration_source_id')::uuid
    END,
    NULLIF(p_payload->>'tracking_code', ''),
    COALESCE(p_payload->>'status', 'nenhum_agendamento')::public.student_status,
    CASE
      WHEN COALESCE(p_payload->>'exam_date_id', '') = '' THEN NULL
      ELSE (p_payload->>'exam_date_id')::uuid
    END,
    CASE
      WHEN COALESCE(p_payload->>'exam_date', '') = '' THEN NULL
      ELSE (p_payload->>'exam_date')::date
    END,
    v_token
  )
  RETURNING id INTO v_student_id;

  IF jsonb_typeof(v_additional_phones) = 'array' AND jsonb_array_length(v_additional_phones) > 0 THEN
    FOR v_phone IN
      SELECT trim(value)
      FROM jsonb_array_elements_text(v_additional_phones) AS value
    LOOP
      IF length(regexp_replace(v_phone, '\D', '', 'g')) IN (10, 11) THEN
        INSERT INTO public.student_phones (student_id, phone_number)
        VALUES (v_student_id, v_phone);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_student_id,
    'registration_token', v_token::text
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_student(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_student(jsonb) TO anon, authenticated;

-- Limpeza periódica (executar via cron opcional)
-- DELETE FROM public.registration_rate_limits WHERE created_at < now() - interval '7 days';
