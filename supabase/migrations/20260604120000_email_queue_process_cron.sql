-- Drena a fila de e-mails em lotes pequenos a cada 5 minutos (evita picos no Apps Script).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-automation-process-queue') THEN
    PERFORM cron.unschedule('email-automation-process-queue');
  END IF;
END $$;

SELECT cron.schedule(
  'email-automation-process-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/email-automation',
    headers := COALESCE(
      public.get_email_automation_auth_headers(),
      public.get_cron_edge_auth_headers()
    ),
    body := '{"source":"process_queue"}'::jsonb
  )
  WHERE COALESCE(
    public.get_email_automation_auth_headers(),
    public.get_cron_edge_auth_headers()
  ) IS NOT NULL;
  $$
);
