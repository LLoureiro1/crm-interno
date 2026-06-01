-- Script para configurar execução automática diária das Edge Functions via pg_cron
-- Pré-requisito: service_role_key em system_internal_config
--
--   INSERT INTO public.system_internal_config (key, value)
--   VALUES ('service_role_key', 'eyJ...sua-service-role-key...')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

SELECT * FROM pg_extension WHERE extname = 'pg_cron';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-student-statuses-daily') THEN
    PERFORM cron.unschedule('update-student-statuses-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'update-student-statuses-daily',
  '0 3 * * *',
  $$
  SELECT public.invoke_cron_edge_function(
    'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/update-student-statuses',
    'update-student-statuses'
  );
  $$
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-missed-interviews') THEN
    PERFORM cron.unschedule('check-missed-interviews');
  END IF;
END $$;

SELECT cron.schedule(
  'check-missed-interviews',
  '0 9 * * *',
  $$
  SELECT public.invoke_cron_edge_function(
    'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/check-missed-interviews',
    'check-missed-interviews'
  );
  $$
);

SELECT
  public.get_cron_edge_auth_headers() IS NOT NULL AS cron_auth_ok,
  (public.get_cron_edge_auth_headers() ? 'Authorization') AS has_authorization;

SELECT jobname, schedule FROM cron.job ORDER BY jobname;

-- SELECT * FROM public.edge_function_logs ORDER BY created_at DESC LIMIT 20;
