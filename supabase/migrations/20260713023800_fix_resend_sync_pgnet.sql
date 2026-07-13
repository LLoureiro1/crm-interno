-- Corrige handle_resend_sync para não falhar quando pg_net (schema "net") não existe
CREATE OR REPLACE FUNCTION handle_resend_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_url text;
  payload jsonb;
  service_key text;
BEGIN
  -- Tenta buscar a chave de serviço; se falhar, sai silenciosamente
  BEGIN
    SELECT value INTO service_key
    FROM app_config
    WHERE key = 'supabase_service_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  request_url := current_setting('app.resend_sync_url', true);
  IF request_url IS NULL OR request_url = '' THEN
    RETURN NEW;
  END IF;

  payload := to_jsonb(NEW);

  -- Tenta fazer a chamada HTTP; ignora silenciosamente se pg_net não estiver disponível
  BEGIN
    PERFORM net.http_post(
      url := request_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, '')
      ),
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net não disponível ou outro erro — continua sem falhar
    NULL;
  END;

  RETURN NEW;
END;
$$;
