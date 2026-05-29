-- Adiciona o novo tipo de trigger ao enum
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'attended_over_a_week_ago';

-- Template padrão para o novo evento
INSERT INTO public.email_templates (unit_id, trigger_type, name, subject, html_body, send_offset_days, send_at_hour, send_at_minute)
VALUES (
  NULL,
  'attended_over_a_week_ago',
  'Pós-atendimento 7 dias (padrão)',
  'Como foi seu atendimento na {{unit_name}}?',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1e40af;">Olá, {{student_name}}!</h2>
    <p>Faz uma semana desde o seu atendimento na <strong>{{unit_name}}</strong>.</p>
    <p>Gostaríamos de saber como foi sua experiência e se ficou alguma dúvida sobre o processo seletivo.</p>
    <p>Entre em contato conosco sempre que precisar.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #6b7280; font-size: 14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
  </div>',
  0,
  9,
  0
)
ON CONFLICT DO NOTHING;
