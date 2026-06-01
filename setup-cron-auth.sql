-- =============================================================================
-- Passo 1: configure a service_role key para os cron jobs
--
-- 1. Dashboard → Project Settings → API → copie "service_role" (secret)
-- 2. Substitua COLE_SUA_SERVICE_ROLE_KEY_AQUI abaixo
-- 3. Execute este script no SQL Editor
--
-- Passo 2 (obrigatório para os crons voltarem a rodar):
--   supabase db push
--   ou execute setup-cron-job.sql no SQL Editor
-- =============================================================================

-- Garante tabela + função de leitura (caso a migration ainda não tenha sido aplicada)
CREATE TABLE IF NOT EXISTS public.system_internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_internal_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.system_internal_config FROM PUBLIC;
REVOKE ALL ON TABLE public.system_internal_config FROM anon;
REVOKE ALL ON TABLE public.system_internal_config FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_cron_edge_auth_headers()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_key text;
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name IN ('service_role_key', 'supabase_service_role_key')
    ORDER BY CASE name WHEN 'service_role_key' THEN 0 ELSE 1 END
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  IF v_service_key IS NULL OR btrim(v_service_key) = '' THEN
    SELECT value INTO v_service_key
    FROM public.system_internal_config
    WHERE key = 'service_role_key'
    LIMIT 1;
  END IF;

  IF v_service_key IS NULL OR btrim(v_service_key) = '' THEN
    RETURN NULL;
  END IF;

  v_service_key := btrim(v_service_key);

  RETURN v_headers || jsonb_build_object(
    'apikey', v_service_key,
    'Authorization', 'Bearer ' || v_service_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_edge_auth_headers() FROM PUBLIC;

-- Cole sua service_role key aqui ↓
INSERT INTO public.system_internal_config (key, value)
VALUES ('service_role_key', 'COLE_SUA_SERVICE_ROLE_KEY_AQUI')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- Verificar (não exibe o valor completo)
SELECT
  key,
  length(value) AS key_length,
  left(value, 12) || '...' AS key_prefix,
  value LIKE 'eyJ%' AS jwt_prefix_ok,
  updated_at
FROM public.system_internal_config
WHERE key = 'service_role_key';

SELECT public.get_cron_edge_auth_headers() IS NOT NULL AS cron_auth_ok;
