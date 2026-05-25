-- Pacote incremental: fecha INSERT anon em appointments e padroniza cron jobs com service_role

-- =============================================================================
-- 1) Appointments: remover INSERT anon (auto-agendamento usa RPC SECURITY DEFINER)
-- =============================================================================

DROP POLICY IF EXISTS "Allow insert for all users" ON public.appointments;

DROP POLICY IF EXISTS "Appointments insert for authenticated staff" ON public.appointments;

CREATE POLICY "Appointments insert for authenticated staff"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
  )
);

-- =============================================================================
-- 2) Cron jobs: usar service_role via app.settings (não anon hardcoded)
-- Configure uma vez no SQL Editor (substitua pela sua service_role key):
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJ...';
-- =============================================================================

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
      'Authorization', 'Bearer ' || COALESCE(nullif(current_setting('app.settings.service_role_key', true), ''), '')
    ),
    body := '{"source":"cron"}'::jsonb
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
  SELECT net.http_post(
    url := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/check-missed-interviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(nullif(current_setting('app.settings.service_role_key', true), ''), '')
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

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
      'Authorization', 'Bearer ' || COALESCE(nullif(current_setting('app.settings.service_role_key', true), ''), '')
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
