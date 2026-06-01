-- Template padrão: aviso interno ao colaborador (entrevistador) quando um atendimento é agendado.
INSERT INTO public.email_templates (
  unit_id,
  trigger_type,
  name,
  subject,
  html_body,
  send_offset_days,
  send_at_hour
)
SELECT
  NULL,
  'appointment_scheduled_staff',
  '[INTERNO — Colaborador] Aviso de novo atendimento',
  '[INTERNO — Colaborador] Atendimento agendado: {{student_name}} — {{appointment_date}} às {{appointment_time}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #7c2d12; color: #fff; padding: 12px 16px; border-radius: 8px 8px 0 0; font-size: 13px; font-weight: bold; letter-spacing: 0.02em;">
      E-MAIL INTERNO — USO EXCLUSIVO DA EQUIPE (NÃO ENVIAR A FAMÍLIAS/INSCRITOS)
    </div>
    <div style="border: 2px solid #ea580c; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      <p style="margin: 0 0 16px; padding: 10px 12px; background: #fff7ed; border-left: 4px solid #ea580c; color: #9a3412; font-size: 14px;">
        <strong>Destinatário:</strong> colaborador(a) que realizará o atendimento (<strong>{{interviewer_name}}</strong>).
        Esta mensagem é apenas para ciência interna no sistema.
      </p>
      <h2 style="color: #1e40af; margin-top: 0;">Novo atendimento na sua agenda</h2>
      <p>Olá, <strong>{{interviewer_name}}</strong>!</p>
      <p>Foi agendado um atendimento para você realizar na <strong>{{unit_name}}</strong>:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 15px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Inscrito</td><td style="padding: 6px 0;"><strong>{{student_name}}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Responsável</td><td style="padding: 6px 0;">{{responsible_name}}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">E-mail do inscrito</td><td style="padding: 6px 0;">{{email}}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Turma</td><td style="padding: 6px 0;">{{class_name}}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Data</td><td style="padding: 6px 0;"><strong>{{appointment_date}}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Horário</td><td style="padding: 6px 0;"><strong>{{appointment_time}}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Modalidade</td><td style="padding: 6px 0;"><strong>{{appointment_modality}}</strong></td></tr>
      </table>
      <p style="color: #6b7280; font-size: 14px;">Confira sua agenda no CRM e prepare o atendimento com antecedência.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">Mensagem automática do sistema — não responda a este e-mail se for apenas notificação interna.</p>
    </div>
  </div>',
  0,
  8
WHERE NOT EXISTS (
  SELECT 1
  FROM public.email_templates t
  WHERE t.unit_id IS NULL
    AND t.trigger_type = 'appointment_scheduled_staff'
);
