-- Corrige cron jobs que passaram a falhar (403) após exigência de service role nas Edge Functions.
-- Configure a chave UMA vez no SQL Editor (Dashboard → Project Settings → API → service_role):
--
--   INSERT INTO public.system_internal_config (key, value)
--   VALUES ('service_role_key', 'eyJ...sua-service-role-key...')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
-- Depois redeploy das functions e desative "Verify JWT" em:
--   update-student-statuses, check-missed-interviews

-- =============================================================================
-- 1) Logs persistentes das Edge Functions (auth, erros, sucesso)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  source text,
  status text NOT NULL,
  http_status integer,
  message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_function_logs_fn_created
  ON public.edge_function_logs (function_name, created_at DESC);

ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.edge_function_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.edge_function_logs FROM anon;
REVOKE ALL ON TABLE public.edge_function_logs FROM authenticated;

COMMENT ON TABLE public.edge_function_logs IS
  'Auditoria de execuções de Edge Functions (escrita via service role; sem políticas RLS).';

-- =============================================================================
-- 2) Headers de auth para cron → Edge Functions (Vault ou system_internal_config)
-- =============================================================================

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

CREATE OR REPLACE FUNCTION public.invoke_cron_edge_function(
  p_url text,
  p_function_name text,
  p_body jsonb DEFAULT '{"source":"cron"}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_request_id bigint;
BEGIN
  v_headers := public.get_cron_edge_auth_headers();

  IF v_headers IS NULL THEN
    INSERT INTO public.edge_function_logs (function_name, source, status, message, details)
    VALUES (
      p_function_name,
      'cron',
      'auth_config_missing',
      'service_role_key não configurada em system_internal_config ou Vault',
      jsonb_build_object(
        'url', p_url,
        'hint', 'INSERT INTO system_internal_config (key, value) VALUES (''service_role_key'', ''eyJ...'')'
      )
    );
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := p_url,
    headers := v_headers,
    body := p_body
  ) INTO v_request_id;

  INSERT INTO public.edge_function_logs (function_name, source, status, message, details)
  VALUES (
    p_function_name,
    'cron',
    'dispatched',
    'Requisição enviada via pg_net',
    jsonb_build_object('url', p_url, 'request_id', v_request_id)
  );

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_cron_edge_function(text, text, jsonb) FROM PUBLIC;

-- =============================================================================
-- 3) Recriar cron jobs usando get_cron_edge_auth_headers()
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-missed-interviews') THEN
    PERFORM cron.unschedule('check-missed-interviews');
  END IF;
END $$;

SELECT cron.schedule(
  'check-missed-interviews',
  '0 9 * * *',
  $$
  SELECT public.invoke_cron_edge_function(
    'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/check-missed-interviews',
    'check-missed-interviews'
  );
  $$
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-student-statuses-daily') THEN
    PERFORM cron.unschedule('update-student-statuses-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'update-student-statuses-daily',
  '0 3 * * *',
  $$
  SELECT public.invoke_cron_edge_function(
    'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/update-student-statuses',
    'update-student-statuses'
  );
  $$
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-automation-daily') THEN
    PERFORM cron.unschedule('email-automation-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'email-automation-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/email-automation',
    headers := COALESCE(
      public.get_email_automation_auth_headers(),
      public.get_cron_edge_auth_headers()
    ),
    body := '{"source":"cron"}'::jsonb
  )
  WHERE COALESCE(
    public.get_email_automation_auth_headers(),
    public.get_cron_edge_auth_headers()
  ) IS NOT NULL;
  $$
);
