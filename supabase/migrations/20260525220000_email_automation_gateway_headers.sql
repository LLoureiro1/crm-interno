-- Gateway Supabase exige Authorization (JWT anon) quando verify_jwt=true.
-- pg_net não envia JWT sozinho: incluir anon public key + x-email-webhook-secret.

CREATE OR REPLACE FUNCTION public.get_email_automation_auth_headers()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_key text;
  v_webhook_secret text;
  v_anon_key text;
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

  BEGIN
    SELECT decrypted_secret INTO v_webhook_secret
    FROM vault.decrypted_secrets
    WHERE name = 'email_automation_webhook_secret'
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  IF v_service_key IS NULL OR v_service_key = '' THEN
    SELECT value INTO v_service_key
    FROM public.system_internal_config
    WHERE key = 'service_role_key'
    LIMIT 1;
  END IF;

  IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
    SELECT value INTO v_webhook_secret
    FROM public.system_internal_config
    WHERE key = 'email_automation_webhook_secret'
    LIMIT 1;
  END IF;

  SELECT value INTO v_anon_key
  FROM public.system_internal_config
  WHERE key = 'supabase_anon_key'
  LIMIT 1;

  IF v_webhook_secret IS NOT NULL AND btrim(v_webhook_secret) <> '' THEN
    v_headers := v_headers || jsonb_build_object(
      'x-email-webhook-secret', btrim(v_webhook_secret)
    );
  END IF;

  IF v_service_key IS NOT NULL AND btrim(v_service_key) <> '' THEN
    v_headers := v_headers || jsonb_build_object(
      'apikey', btrim(v_service_key),
      'Authorization', 'Bearer ' || btrim(v_service_key)
    );
  ELSIF v_anon_key IS NOT NULL
    AND btrim(v_anon_key) <> ''
    AND btrim(v_anon_key) LIKE 'eyJ%'
    AND btrim(v_anon_key) NOT LIKE 'COLE_%' THEN
    v_headers := v_headers || jsonb_build_object(
      'apikey', btrim(v_anon_key),
      'Authorization', 'Bearer ' || btrim(v_anon_key)
    );
  END IF;

  IF v_headers ? 'x-email-webhook-secret' THEN
    RETURN v_headers;
  END IF;

  IF v_service_key IS NOT NULL AND btrim(v_service_key) <> '' THEN
    RETURN v_headers;
  END IF;

  RETURN NULL;
END;
$$;
