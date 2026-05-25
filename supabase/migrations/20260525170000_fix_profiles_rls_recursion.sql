-- Corrige recursão infinita na policy de profiles (42P17)
-- Causa: policy SELECT em profiles consultava public.profiles dentro do USING

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

DROP POLICY IF EXISTS "Profiles select for authenticated" ON public.profiles;

CREATE POLICY "Profiles select for authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR ativo = true
  OR public.auth_user_is_admin()
);

-- students DELETE também consultava profiles diretamente na policy
DROP POLICY IF EXISTS "Students delete by unit and role" ON public.students;

CREATE POLICY "Students delete by unit and role"
ON public.students
FOR DELETE
TO authenticated
USING (
  public.user_has_student_access(unit_id)
  AND public.auth_user_is_admin()
);
