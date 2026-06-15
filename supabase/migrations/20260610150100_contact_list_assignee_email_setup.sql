-- Template + trigger (migration separada do ADD VALUE do enum)

INSERT INTO public.email_templates (
  unit_id, trigger_type, name, subject, html_body,
  is_active, send_offset_days, send_at_hour, send_at_minute
)
SELECT
  NULL,
  'staff_contact_list_assigned'::public.email_trigger_type,
  '[INTERNO] Designação em lista de contato (padrão)',
  '[INTERNO] Você foi designado na lista: {{list_name}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #2563eb; padding-left: 16px;">
      <h2 style="color: #1e40af;">Lista de contato designada</h2>
      <p>Olá, <strong>{{assignee_name}}</strong>!</p>
      <p>Você foi designado para a lista <strong>{{list_name}}</strong> com <strong>{{active_count}}</strong> aluno(s) ativo(s) sob sua responsabilidade.</p>
      <p style="margin: 24px 0;">
        <a href="{{contact_list_link}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Acessar Minhas Listas no CRM
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">E-mail automático interno — Gestão de Inscritos → Minhas Listas.</p>
    </div>',
  true, 0, 8, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates
  WHERE unit_id IS NULL AND trigger_type = 'staff_contact_list_assigned'::public.email_trigger_type
);

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

  PERFORM net.http_post(
    url := request_url,
    headers := public.get_email_automation_auth_headers(),
    body := payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_on_contact_list_assignee ON public.contact_list_assignees;
CREATE TRIGGER trg_email_on_contact_list_assignee
  AFTER INSERT ON public.contact_list_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_contact_list_assignee_email();
