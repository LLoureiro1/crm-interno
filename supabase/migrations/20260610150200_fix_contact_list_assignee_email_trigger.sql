-- Corrige disparo do e-mail de designação (auth service_role via invoke_cron_edge_function)

CREATE OR REPLACE FUNCTION public.handle_contact_list_assignee_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  request_url text := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/email-automation';
BEGIN
  payload := jsonb_build_object(
    'source', 'webhook',
    'trigger_type', 'staff_contact_list_assigned',
    'table', TG_TABLE_NAME,
    'type', TG_OP,
    'record', row_to_json(NEW)
  );

  PERFORM public.invoke_cron_edge_function(
    request_url,
    'email-automation',
    payload
  );

  RETURN NEW;
END;
$$;

-- Garante template padrão ativo
UPDATE public.email_templates
SET is_active = true, updated_at = now()
WHERE unit_id IS NULL
  AND trigger_type = 'staff_contact_list_assigned'::public.email_trigger_type;
