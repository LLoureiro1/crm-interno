-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create the function that sends the webhook to the Edge Function
CREATE OR REPLACE FUNCTION public.handle_resend_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  request_url text := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/resend-sync';
  service_key text;
BEGIN
  -- Attempt to get the service_role_key. 
  -- We use 'true' as the second argument to avoid errors if the setting is missing.
  service_key := current_setting('app.settings.service_role_key', true);

  -- Fallback: If service_key is null, we might want to log a warning or use a placeholder.
  -- For now, we proceed. If the Edge Function enforces JWT, this request might fail (401)
  -- if the key is missing. The user must ensure this setting is available 
  -- or "Verify JWT" is disabled for this function.
  
  -- Construct payload matching standard Supabase webhook format
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- Send the async HTTP request via pg_net
  -- We use perform to discard the result since it's an async void operation in this context
  PERFORM net.http_post(
    url := request_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on the students table
DROP TRIGGER IF EXISTS trg_resend_sync ON public.students;

CREATE TRIGGER trg_resend_sync
AFTER INSERT OR UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.handle_resend_sync();
