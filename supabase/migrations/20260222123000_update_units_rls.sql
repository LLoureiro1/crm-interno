-- Atualiza políticas RLS da tabela units para controlar visibilidade por unidade

-- Garante que RLS está habilitado na tabela units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Remove todas as políticas existentes de SELECT em units
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'units'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.units', pol.policyname);
  END LOOP;
END;
$$;

-- Nova política de SELECT:
-- 1) Clientes anônimos (sem login) precisam listar todas as unidades para se cadastrar
CREATE POLICY "Units select for anonymous clients"
ON public.units
FOR SELECT
TO anon
USING (true);

-- 2) Usuários autenticados:
--    - Se pertencem à unidade com slug 'central', veem todas as unidades
--    - Caso contrário, veem apenas a própria unidade (units.id = profiles.unit_id)
CREATE POLICY "Units select by central and own unit"
ON public.units
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.units u_user ON u_user.id = p.unit_id
    WHERE p.id = auth.uid()
      AND (
        u_user.slug = 'central'
        OR (p.unit_id IS NOT NULL AND p.unit_id = public.units.id)
      )
  )
);
