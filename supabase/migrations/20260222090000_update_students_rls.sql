-- Atualiza políticas RLS da tabela students para refletir regras de visibilidade por unidade/role

-- Garante que RLS está habilitado na tabela students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Remove todas as políticas existentes de SELECT em students
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.students', pol.policyname);
  END LOOP;
END;
$$;

-- Nova política de SELECT:
-- - Usuários da unidade com slug 'central' veem alunos de todas as unidades (qualquer profile)
-- - Usuários com profile 'admin' veem alunos de todas as unidades (qualquer unidade)
-- - Demais usuários veem apenas alunos da própria unidade (students.unit_id = profiles.unit_id)
CREATE POLICY "Students select by unit and role"
ON public.students
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.units u_user ON u_user.id = p.unit_id
    WHERE p.id = auth.uid()
      AND (
        u_user.slug = 'central'
        OR p.profile = 'admin'::user_profile
        OR (p.unit_id IS NOT NULL AND p.unit_id = public.students.unit_id)
      )
  )
);

