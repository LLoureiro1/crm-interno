-- Corrige disparo de e-mails após hardening da Edge Function email-automation.
-- O trigger/cron precisam enviar credenciais válidas (service role OU segredo de webhook).

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
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
BEGIN
  -- 1) Service role (compatível com verify_jwt = true na Edge Function)
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

  IF v_service_key IS NULL OR v_service_key = '' THEN
    v_service_key := nullif(trim(current_setting('app.settings.service_role_key', true)), '');
  END IF;

  IF v_service_key IS NOT NULL AND v_service_key <> '' THEN
    v_headers := v_headers || jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_key
    );
  END IF;

  -- 2) Segredo dedicado (com verify_jwt = false na função)
  BEGIN
    SELECT decrypted_secret INTO v_webhook_secret
    FROM vault.decrypted_secrets
    WHERE name = 'email_automation_webhook_secret'
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
    v_webhook_secret := nullif(trim(current_setting('app.settings.email_automation_webhook_secret', true)), '');
  END IF;

  IF v_webhook_secret IS NOT NULL AND v_webhook_secret <> '' THEN
    v_headers := v_headers || jsonb_build_object(
      'x-email-webhook-secret', v_webhook_secret
    );
  END IF;

  IF v_headers ? 'Authorization' OR v_headers ? 'x-email-webhook-secret' THEN
    RETURN v_headers;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_automation_auth_headers() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_email_automation_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  trigger_type text;
  request_url text := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/email-automation';
  auth_headers jsonb;
BEGIN
  IF TG_TABLE_NAME = 'students' AND TG_OP = 'INSERT' THEN
    trigger_type := 'student_registered';
  ELSIF TG_TABLE_NAME = 'appointments' AND TG_OP = 'INSERT' THEN
    trigger_type := 'appointment_scheduled';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  auth_headers := public.get_email_automation_auth_headers();

  IF auth_headers IS NULL THEN
    RAISE WARNING
      'email-automation: configure app.settings.service_role_key ou app.settings.email_automation_webhook_secret (e o secret na Edge Function)';
    RETURN COALESCE(NEW, OLD);
  END IF;

  payload := jsonb_build_object(
    'source', 'webhook',
    'trigger_type', trigger_type,
    'table', TG_TABLE_NAME,
    'type', TG_OP,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := request_url,
    headers := auth_headers,
    body := payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Reagenda cron diário com os mesmos headers de autenticação
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
    headers := public.get_email_automation_auth_headers(),
    body := '{"source":"cron"}'::jsonb
  )
  WHERE public.get_email_automation_auth_headers() IS NOT NULL;
  $$
);
