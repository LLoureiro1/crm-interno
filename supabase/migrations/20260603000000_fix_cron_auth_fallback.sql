-- Corrige get_cron_edge_auth_headers para retornar headers mínimos de Content-Type caso service_role_key não esteja configurada.
-- Isso permite o disparo do cron via pg_net e delegação do trust da chamada automática para a lógica interna das Edge Functions (verify_jwt = false).

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
  -- 1) Tenta obter do Vault
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

  -- 2) Tenta obter de system_internal_config
  IF v_service_key IS NULL OR btrim(v_service_key) = '' THEN
    SELECT value INTO v_service_key
    FROM public.system_internal_config
    WHERE key = 'service_role_key'
    LIMIT 1;
  END IF;

  -- 3) Se não houver service_role_key configurada, retorna os headers básicos (sem Authorization)
  -- para que o pg_net possa disparar a chamada à Edge Function, que por sua vez confiará
  -- na chamada automática (isAutomatedCall = true com verify_jwt = false).
  IF v_service_key IS NULL OR btrim(v_service_key) = '' THEN
    RETURN v_headers;
  END IF;

  v_service_key := btrim(v_service_key);

  RETURN v_headers || jsonb_build_object(
    'apikey', v_service_key,
    'Authorization', 'Bearer ' || v_service_key
  );
END;
$$;

-- Redefine invoke_cron_edge_function para garantir compatibilidade completa
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
