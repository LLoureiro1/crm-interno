-- Cron diário para lembretes de e-mail e processamento da fila
-- Pré-requisito: setup-email-webhook-auth.sql + Verify JWT desligado em email-automation
-- Execute no SQL Editor do Supabase após db push e deploy da função email-automation

SELECT cron.unschedule('email-automation-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'email-automation-daily'
);

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

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'email-automation-daily';
