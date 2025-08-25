-- Add 'ausente' status to the student_status enum (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'student_status'::regtype AND enumlabel = 'ausente') THEN
        ALTER TYPE student_status ADD VALUE 'ausente';
    END IF;
END $$;

-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the edge function to run daily at 03:00 UTC
SELECT cron.schedule(
  'update-student-statuses-daily',
  '0 3 * * *', -- Daily at 03:00 UTC
  $$
  SELECT
    net.http_post(
        url:='https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/update-student-statuses',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHpic2Z5d2ZjdXlscWdhZnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MDcwNTUsImV4cCI6MjA2NDE4MzA1NX0.lT-C9ibaoSGVx-_D5W--Vxj0uU1FBQygRUjeQFK-bFk"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);