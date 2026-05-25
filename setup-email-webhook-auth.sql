-- =============================================================================
-- Automação de e-mail: setup do trigger (SEM colar tokens no SQL)
--
-- Secrets ficam SOMENTE na Edge Function (Dashboard ou CLI):
--   EMAIL_AUTOMATION_WEBHOOK_SECRET  (opcional, para testes manuais)
--   GOOGLE_APPS_SCRIPT_WEBHOOK_URL
--   GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN
--
-- O Postgres NÃO consegue ler secrets da Edge — por isso o trigger envia só JSON.
--
-- OBRIGATÓRIO no painel:
--   Edge Functions → email-automation → desative "Verify JWT"
--
-- Depois:
--   npx supabase functions deploy email-automation
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.get_email_automation_auth_headers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('Content-Type', 'application/json');
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
BEGIN
  IF TG_TABLE_NAME = 'students' AND TG_OP = 'INSERT' THEN
    trigger_type := 'student_registered';
  ELSIF TG_TABLE_NAME = 'appointments' AND TG_OP = 'INSERT' THEN
    trigger_type := 'appointment_scheduled';
  ELSE
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
    headers := public.get_email_automation_auth_headers(),
    body := payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Garante triggers ativos
DROP TRIGGER IF EXISTS trg_email_on_student_insert ON public.students;
CREATE TRIGGER trg_email_on_student_insert
  AFTER INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_automation_webhook();

DROP TRIGGER IF EXISTS trg_email_on_appointment_insert ON public.appointments;
CREATE TRIGGER trg_email_on_appointment_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_automation_webhook();

SELECT public.get_email_automation_auth_headers() AS headers_ok;
