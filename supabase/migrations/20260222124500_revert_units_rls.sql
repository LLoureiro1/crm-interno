-- Reverte as mudanças de RLS feitas em 20260222123000_update_units_rls.sql
-- Objetivo: voltar ao comportamento anterior, sem restrição de visibilidade em units

-- Desabilita RLS na tabela units
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;

-- Remove quaisquer policies existentes em units (incluindo as criadas na migration anterior)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'units'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.units', pol.policyname);
  END LOOP;
END;
$$;

