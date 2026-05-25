-- O Postgres não lê secrets da Edge Function. Trigger chama a função só com JSON;
-- EMAIL_AUTOMATION_WEBHOOK_SECRET e Google Apps Script ficam só nos secrets da Edge.

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

-- Cron diário: mesmos headers mínimos (verify_jwt=false na função)
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
  );
  $$
);
