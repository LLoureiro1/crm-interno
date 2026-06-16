-- Botão com link direto para Inscritos → Minhas Listas

UPDATE public.email_templates
SET
  html_body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #2563eb; padding-left: 16px;">
      <h2 style="color: #1e40af;">Lista de contato designada</h2>
      <p>Olá, <strong>{{assignee_name}}</strong>!</p>
      <p>Você foi designado para a lista <strong>{{list_name}}</strong> com <strong>{{active_count}}</strong> aluno(s) ativo(s) sob sua responsabilidade.</p>
      <p style="margin: 24px 0;">
        <a href="{{contact_list_link}}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Acessar Minhas Listas no CRM
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">E-mail automático interno — Gestão de Inscritos → Minhas Listas.</p>
    </div>',
  updated_at = now()
WHERE trigger_type = 'staff_contact_list_assigned'::public.email_trigger_type;
