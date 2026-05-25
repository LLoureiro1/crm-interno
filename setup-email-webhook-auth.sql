-- =============================================================================
-- Execute TODO este arquivo no SQL Editor do Supabase (copie e cole de uma vez).
-- Não use ALTER DATABASE (erro 42501 no hosted).
--
-- Antes: defina o MESMO token na Edge Function:
--   npx supabase secrets set EMAIL_AUTOMATION_WEBHOOK_SECRET='seu-token-aqui'
--   npx supabase functions deploy email-automation
-- =============================================================================

-- 1) Tabela interna (se a migration ainda não foi aplicada via db push)
CREATE TABLE IF NOT EXISTS public.system_internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_internal_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.system_internal_config FROM PUBLIC;
REVOKE ALL ON TABLE public.system_internal_config FROM anon;
REVOKE ALL ON TABLE public.system_internal_config FROM authenticated;

-- 2) Função que monta os headers para o trigger/cron
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

  IF v_service_key IS NOT NULL AND btrim(v_service_key) <> '' THEN
    v_headers := v_headers || jsonb_build_object(
      'Authorization', 'Bearer ' || btrim(v_service_key)
    );
  END IF;

  IF v_webhook_secret IS NOT NULL AND btrim(v_webhook_secret) <> '' THEN
    v_headers := v_headers || jsonb_build_object(
      'x-email-webhook-secret', btrim(v_webhook_secret)
    );
  END IF;

  IF v_headers ? 'Authorization' OR v_headers ? 'x-email-webhook-secret' THEN
    RETURN v_headers;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_automation_auth_headers() FROM PUBLIC;

-- 3) Trigger webhook (atualiza se já existir)
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
      'email-automation: configure email_automation_webhook_secret em system_internal_config';
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

-- 4) Grave o token (SUBSTITUA pelo mesmo valor do secret da Edge Function)
INSERT INTO public.system_internal_config (key, value)
VALUES ('email_automation_webhook_secret', 'RMXgW41hcuToz7J3o4LEIZ5H7Vxvv393')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

-- 5) Verificação
SELECT public.get_email_automation_auth_headers() IS NOT NULL AS credenciais_ok;
