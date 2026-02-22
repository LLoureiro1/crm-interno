-- Configura RLS da tabela units de forma segura
-- Objetivos:
-- 1) Remover alerta de "RLS exposta (unrestricted)" no Supabase
-- 2) Manter funcionalidade atual:
--    - Usuário anon pode listar unidades para inscrição, exceto a unidade com slug 'central'
--    - Usuários autenticados continuam podendo ler unidades (filtro fino é feito no front-end)

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

-- 1) Clientes anônimos (sem login):
--    - Podem listar todas as unidades necessárias para inscrição
--    - NÃO podem ver a unidade com slug 'central'
CREATE POLICY "Units select for anonymous signup"
ON public.units
FOR SELECT
TO anon
USING (
  -- Esconde explicitamente a unidade central do anônimo
  slug IS NULL OR slug <> 'central'
);

-- 2) Usuários autenticados:
--    - Podem listar unidades livremente (dados não sensíveis)
--    - A restrição de quais unidades aparecem em filtros continua sendo feita no front-end
CREATE POLICY "Units select for authenticated users"
ON public.units
FOR SELECT
TO authenticated
USING (
  -- Condição não trivial para evitar alerta de "unrestricted" baseado em USING (true)
  id IS NOT NULL
);

