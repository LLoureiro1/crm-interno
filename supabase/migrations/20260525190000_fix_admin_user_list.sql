-- Lista de usuários para admin via RPC (sem views com policy)

CREATE OR REPLACE FUNCTION public.list_users_for_admin()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  unit_id uuid,
  profile public.user_profile,
  ativo boolean,
  created_at timestamptz
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
    p.created_at
  FROM public.profiles p
  WHERE public.auth_user_is_admin()
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users_for_admin() TO authenticated;

-- Views não aceitam CREATE POLICY (42809). Remove admin_profiles; admin usa RPC acima.
DROP VIEW IF EXISTS public.admin_profiles CASCADE;

-- staff_directory: security_invoker aplica RLS de profiles (sem policy na view)
DROP VIEW IF EXISTS public.staff_directory CASCADE;

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
