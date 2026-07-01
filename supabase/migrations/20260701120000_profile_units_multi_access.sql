-- Acesso a múltiplas unidades por usuário (profile_units)

-- =============================================================================
-- 1) Tabela de vínculo N:N
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profile_units (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_units_unit_id ON public.profile_units(unit_id);

-- Backfill: usuários existentes com unit_id ganham entrada em profile_units
INSERT INTO public.profile_units (profile_id, unit_id)
SELECT p.id, p.unit_id
FROM public.profiles p
WHERE p.unit_id IS NOT NULL
ON CONFLICT (profile_id, unit_id) DO NOTHING;

ALTER TABLE public.profile_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile units select own or admin"
ON public.profile_units
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR public.auth_user_is_admin()
);

-- =============================================================================
-- 2) Helpers de acesso por unidade
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_unit_access(p_unit_id uuid)
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
        OR EXISTS (
          SELECT 1
          FROM public.profile_units pu
          WHERE pu.profile_id = p.id
            AND pu.unit_id = p_unit_id
        )
        OR (p.unit_id IS NOT NULL AND p.unit_id = p_unit_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_unit_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_unit_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_student_access(p_student_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_unit_access(p_student_unit_id);
$$;

-- =============================================================================
-- 3) RLS: students SELECT e appointments SELECT
-- =============================================================================

DROP POLICY IF EXISTS "Students select by unit and role" ON public.students;

CREATE POLICY "Students select by unit and role"
ON public.students
FOR SELECT
TO authenticated
USING (public.user_has_student_access(unit_id));

DROP POLICY IF EXISTS "Appointments select by unit and central" ON public.appointments;

CREATE POLICY "Appointments select by unit and central"
ON public.appointments
FOR SELECT
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
-- 4) RPC: acesso do usuário logado (front-end)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_unit_access()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'full_access',
    EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.units u ON u.id = p.unit_id
      WHERE p.id = auth.uid()
        AND p.ativo = true
        AND (
          p.profile = 'admin'::public.user_profile
          OR u.slug = 'central'
        )
    ),
    'unit_ids',
    COALESCE(
      (
        SELECT array_agg(pu.unit_id ORDER BY un.name)
        FROM public.profile_units pu
        JOIN public.units un ON un.id = pu.unit_id
        WHERE pu.profile_id = auth.uid()
      ),
      ARRAY[]::uuid[]
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_unit_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_unit_access() TO authenticated;

-- =============================================================================
-- 5) RPC: admin define unidades de um perfil
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_profile_units(
  p_profile_id uuid,
  p_unit_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  DELETE FROM public.profile_units WHERE profile_id = p_profile_id;

  IF p_unit_ids IS NOT NULL AND cardinality(p_unit_ids) > 0 THEN
    INSERT INTO public.profile_units (profile_id, unit_id)
    SELECT p_profile_id, unnest(p_unit_ids)
    ON CONFLICT (profile_id, unit_id) DO NOTHING;

    UPDATE public.profiles
    SET unit_id = p_unit_ids[1]
    WHERE id = p_profile_id;
  ELSE
    UPDATE public.profiles
    SET unit_id = NULL
    WHERE id = p_profile_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_profile_units(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_units(uuid, uuid[]) TO authenticated;

-- =============================================================================
-- 6) RPC: listagem de usuários para admin (inclui unit_ids)
-- =============================================================================

DROP FUNCTION IF EXISTS public.list_users_for_admin();

CREATE OR REPLACE FUNCTION public.list_users_for_admin()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  unit_id uuid,
  profile public.user_profile,
  ativo boolean,
  created_at timestamptz,
  unit_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.email,
    p.unit_id,
    p.profile,
    p.ativo,
    p.created_at,
    COALESCE(
      (
        SELECT array_agg(pu.unit_id ORDER BY un.name)
        FROM public.profile_units pu
        JOIN public.units un ON un.id = pu.unit_id
        WHERE pu.profile_id = p.id
      ),
      ARRAY[]::uuid[]
    ) AS unit_ids
  FROM public.profiles p
  WHERE public.auth_user_is_admin()
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users_for_admin() TO authenticated;
