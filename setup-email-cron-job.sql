-- Cron diário para lembretes de e-mail e processamento da fila
-- Pré-requisito: ALTER DATABASE postgres SET app.settings.service_role_key = 'sua-service-role-key';
-- Execute no SQL Editor do Supabase após o deploy da função email-automation

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
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(nullif(current_setting('app.settings.service_role_key', true), ''), ''),
      'Content-Type', 'application/json'
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'email-automation-daily';
