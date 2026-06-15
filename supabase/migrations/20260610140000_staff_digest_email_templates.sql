-- Templates internos: digest diário com lista de alunos (1 e-mail/dia/destinatário/unidade)

UPDATE public.email_templates
SET
  subject = '[INTERNO] {{student_count}} inscrito(s) sem agendamento — {{unit_name}}',
  html_body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #f59e0b; padding-left: 16px;">
      <h2 style="color: #92400e;">[ALERTA INTERNO] Inscritos sem agendamento</h2>
      <p>Resumo diário: <strong>{{student_count}}</strong> inscrito(s) há mais de 24 horas sem agendamento na unidade <strong>{{unit_name}}</strong>.</p>
      {{student_list}}
      <p style="color:#6b7280;font-size:13px;">Este é um e-mail automático interno enviado 1 vez ao dia. Não compartilhe com o responsável.</p>
    </div>',
  updated_at = now()
WHERE trigger_type = 'staff_new_lead_no_appointment';

UPDATE public.email_templates
SET
  subject = '[INTERNO] {{student_count}} faltou(aram) ao atendimento sem reagendar — {{unit_name}}',
  html_body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #ef4444; padding-left: 16px;">
      <h2 style="color: #991b1b;">[ALERTA INTERNO] Faltas sem reagendamento</h2>
      <p>Resumo diário: <strong>{{student_count}}</strong> inscrito(s) há mais de 24 horas no status <strong>Faltou ao Atendimento</strong> sem reagendamento na unidade <strong>{{unit_name}}</strong>.</p>
      {{student_list}}
      <p style="color:#6b7280;font-size:13px;">Este é um e-mail automático interno enviado 1 vez ao dia. Não compartilhe com o responsável.</p>
    </div>',
  updated_at = now()
WHERE trigger_type = 'staff_missed_appointment_no_reschedule';
