-- Create a cron job to check for missed interviews daily
-- This will run every day at 9 AM to check for students who missed their interviews
SELECT cron.schedule(
  'check-missed-interviews',
  '0 9 * * *', -- Every day at 9 AM
  $$
  SELECT net.http_post(
    url := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/check-missed-interviews',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);