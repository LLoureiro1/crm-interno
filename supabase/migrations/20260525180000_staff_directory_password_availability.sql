-- Diretório de equipe sem e-mail, senha forte no convite, RLS em interviewer_availability

-- =============================================================================
-- 1) Helper: quem pode alterar disponibilidade de entrevistadores
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_can_modify_interviewer_availability(
  p_availability_unit_id uuid,
  p_interviewer_id uuid
)
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
      AND (
        p.profile = 'admin'::public.user_profile
        OR (
          public.user_has_student_access(p_availability_unit_id)
          AND (
            p.profile = 'direcao'::public.user_profile
            OR (
              p.profile = 'entrevistador'::public.user_profile
              AND p.id = p_interviewer_id
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_modify_interviewer_availability(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_modify_interviewer_availability(uuid, uuid) TO authenticated;

-- =============================================================================
-- 2) Profiles: colegas da unidade sem expor e-mail; admin vê tudo via admin_profiles
-- =============================================================================

DROP POLICY IF EXISTS "Profiles select for authenticated" ON public.profiles;

CREATE POLICY "Profiles select for authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_user_is_admin()
  OR (
    ativo = true
    AND public.user_has_student_access(unit_id)
  )
);

REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT (
  id, name, unit_id, profile, ativo, created_at
) ON public.profiles TO authenticated;
GRANT UPDATE (
  name, email, profile, unit_id, ativo
) ON public.profiles TO authenticated;
GRANT INSERT (
  id, name, email, profile, unit_id, ativo
) ON public.profiles TO authenticated;

DROP VIEW IF EXISTS public.staff_directory;

CREATE VIEW public.staff_directory
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  unit_id,
  profile,
  ativo
FROM public.profiles
WHERE ativo = true;

GRANT SELECT ON public.staff_directory TO authenticated;

-- admin_profiles removida: listagem com e-mail via RPC list_users_for_admin (migration 20260525190000)

-- =============================================================================
-- 3) interviewer_availability: INSERT/UPDATE/DELETE por unidade e perfil
-- =============================================================================

DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.interviewer_availability;
DROP POLICY IF EXISTS "Allow update for authenticated" ON public.interviewer_availability;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON public.interviewer_availability;

CREATE POLICY "Interviewer availability insert by unit and role"
ON public.interviewer_availability
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_can_modify_interviewer_availability(unit_id, interviewer_id)
);

CREATE POLICY "Interviewer availability update by unit and role"
ON public.interviewer_availability
FOR UPDATE
TO authenticated
USING (
  public.user_can_modify_interviewer_availability(unit_id, interviewer_id)
)
WITH CHECK (
  public.user_can_modify_interviewer_availability(unit_id, interviewer_id)
);

CREATE POLICY "Interviewer availability delete by unit and role"
ON public.interviewer_availability
FOR DELETE
TO authenticated
USING (
  public.user_can_modify_interviewer_availability(unit_id, interviewer_id)
);

-- =============================================================================
-- 4) Validação de senha forte ao definir senha (convite / reset)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_strong_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_password IS NULL OR length(p_password) < 12 THEN
    RETURN false;
  END IF;

  IF p_password !~ '[A-Z]' THEN
    RETURN false;
  END IF;

  IF p_password !~ '[a-z]' THEN
    RETURN false;
  END IF;

  IF p_password !~ '[0-9]' THEN
    RETURN false;
  END IF;

  IF p_password !~ '[^A-Za-z0-9]' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_strong_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_strong_password(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_strong_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.validate_strong_password(p_password) THEN
    RAISE EXCEPTION
      'Senha fraca: use pelo menos 12 caracteres com maiúscula, minúscula, número e símbolo.'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_strong_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_strong_password(text) TO authenticated, anon;
