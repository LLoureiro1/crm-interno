-- Script para configurar execução automática diária da função update-student-statuses
-- Execute este script no painel do Supabase (SQL Editor)

-- Verificar se a extensão pg_cron está habilitada
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Se não estiver habilitada, habilitar (requer privilégios de superusuário)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover cron job existente se houver
SELECT cron.unschedule('update-student-statuses-daily');

-- Criar novo cron job para executar diariamente às 8h da manhã
SELECT cron.schedule(
  'update-student-statuses-daily',
  '0 8 * * *', -- Todo dia às 8h (formato: minuto hora dia mês dia_da_semana)
  $$
  SELECT net.http_post(
    url := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/update-student-statuses',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- Verificar se o cron job foi criado
SELECT * FROM cron.job WHERE jobname = 'update-student-statuses-daily';

-- Listar todos os cron jobs ativos
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job 
ORDER BY jobid;

-- Para testar o cron job manualmente (opcional)
-- SELECT cron.run_job(jobid) FROM cron.job WHERE jobname = 'update-student-statuses-daily';

-- Para remover o cron job (se necessário)
-- SELECT cron.unschedule('update-student-statuses-daily');
