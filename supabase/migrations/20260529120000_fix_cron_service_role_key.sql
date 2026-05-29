-- =============================================================================
-- FIX: Recriar cron jobs com service_role key hardcoded
-- 
-- ANTES DE EXECUTAR:
--   1. Acesse o Supabase Dashboard → Project Settings → API
--   2. Copie o valor de "service_role" (secret key)
--   3. Substitua TODAS as ocorrências de <<SUA_SERVICE_ROLE_KEY>> abaixo
--   4. Execute este script no SQL Editor do Supabase
--
-- ATENÇÃO: Não faça commit deste arquivo com a key real no repositório.
--          Após rodar, a key ficará armazenada na tabela cron.job (interno ao DB).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) check-missed-interviews
-- -----------------------------------------------------------------------------
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
  SELECT net.http_post(
    url := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/check-missed-interviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <<SUA_SERVICE_ROLE_KEY>>'
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

-- -----------------------------------------------------------------------------
-- 2) update-student-statuses-daily
-- -----------------------------------------------------------------------------
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
  SELECT net.http_post(
    url := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/update-student-statuses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <<SUA_SERVICE_ROLE_KEY>>'
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

-- -----------------------------------------------------------------------------
-- 3) email-automation-daily
-- -----------------------------------------------------------------------------
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <<SUA_SERVICE_ROLE_KEY>>'
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

-- -----------------------------------------------------------------------------
-- Verificar os cron jobs recriados
-- -----------------------------------------------------------------------------
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
