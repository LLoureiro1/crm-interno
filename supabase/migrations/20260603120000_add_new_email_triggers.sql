-- ============================================================
-- Novos templates e triggers de e-mail (2026-06-03)
-- Adiciona 8 novos fluxos de automação de e-mail ao CRM
-- ============================================================

-- 1. Novos valores no enum email_trigger_type
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'invite_to_schedule';
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'exam_reminder_same_day';
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'post_attendance_followup';
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'post_attendance_3_days';
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'matricula_concluida';
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'staff_new_lead_no_appointment';
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'staff_missed_appointment_no_reschedule';
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'staff_proposal_no_response';

-- 2. Coluna para destinatários internos (array de UUIDs de profiles)
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS recipient_user_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.email_templates.recipient_user_ids IS
  'UUIDs de profiles que recebem e-mails internos (templates [INTERNO]). Vazio = todos os usuários ativos da unidade.';

-- ============================================================
-- 3. Atualizar o webhook handler para matricula_concluida
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_email_automation_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  trigger_type text;
  request_url text := 'https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/email-automation';
BEGIN
  IF TG_TABLE_NAME = 'students' AND TG_OP = 'INSERT' THEN
    trigger_type := 'student_registered';
  ELSIF TG_TABLE_NAME = 'students' AND TG_OP = 'UPDATE'
    AND NEW.status = 'faltou_ao_atendimento'
    AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    trigger_type := 'missed_appointment_reschedule';
  ELSIF TG_TABLE_NAME = 'students' AND TG_OP = 'UPDATE'
    AND NEW.status = 'matriculado'
    AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    trigger_type := 'matricula_concluida';
  ELSIF TG_TABLE_NAME = 'appointments' AND TG_OP = 'INSERT' THEN
    trigger_type := 'appointment_scheduled';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  payload := jsonb_build_object(
    'source', 'webhook',
    'trigger_type', trigger_type,
    'table', TG_TABLE_NAME,
    'type', TG_OP,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := request_url,
    headers := public.get_email_automation_auth_headers(),
    body := payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Trigger para matrícula concluída
DROP TRIGGER IF EXISTS trg_email_on_student_status_matriculado ON public.students;
CREATE TRIGGER trg_email_on_student_status_matriculado
  AFTER UPDATE OF status ON public.students
  FOR EACH ROW
  WHEN (NEW.status = 'matriculado' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_email_automation_webhook();

-- ============================================================
-- 5. Função auxiliar: retorna o link de auto-agendamento
--    para alunos em nenhum_agendamento (reutiliza o campo
--    registration_token já existente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_schedule_invite_access(
  p_student_id uuid,
  p_registration_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_student record;
  v_unit record;
BEGIN
  SELECT
    s.id,
    s.student_name,
    s.status,
    s.unit_id,
    s.class_id
  INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.registration_token = p_registration_token;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou expirado');
  END IF;

  IF v_student.status NOT IN ('nenhum_agendamento', 'faltou_ao_atendimento') THEN
    RETURN jsonb_build_object(
      'success', true,
      'eligible', false,
      'reason', 'status_nao_permite',
      'status', v_student.status
    );
  END IF;

  SELECT name, address, phone INTO v_unit
  FROM public.units
  WHERE id = v_student.unit_id;

  RETURN jsonb_build_object(
    'success', true,
    'eligible', true,
    'student_id', v_student.id,
    'student_name', v_student.student_name,
    'unit_id', v_student.unit_id,
    'class_id', v_student.class_id,
    'unit_name', v_unit.name,
    'unit_address', v_unit.address,
    'unit_phone', v_unit.phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_schedule_invite_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_schedule_invite_access(uuid, uuid) TO anon, authenticated;

-- ============================================================
-- 6. Templates padrão para os novos eventos (inativos por padrão)
-- ============================================================
INSERT INTO public.email_templates (
  unit_id, trigger_type, name, subject, html_body,
  is_active, send_offset_days, send_at_hour, send_at_minute
)
VALUES
  -- Convidar para o agendamento
  (
    NULL,
    'invite_to_schedule',
    'Convite para agendamento (padrão)',
    'Agende seu atendimento na {{unit_name}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Olá, {{responsible_name}}!</h2>
      <p>Ficamos felizes com a inscrição de <strong>{{student_name}}</strong> na <strong>{{unit_name}}</strong>!</p>
      <p>O próximo passo é agendar o atendimento com nossa equipe. Escolha o melhor horário clicando no botão abaixo:</p>
      <p style="margin: 24px 0;">
        <a href="{{reschedule_link}}" style="background:#1e40af;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
          Agendar atendimento
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px;">Se o botão não funcionar, copie e cole no navegador:<br/>{{reschedule_link}}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
    </div>',
    false, 0, 9, 0
  ),
  -- Lembrete no dia da prova
  (
    NULL,
    'exam_reminder_same_day',
    'Lembrete de prova no dia (padrão)',
    'Lembrete: a prova de {{student_name}} é hoje!',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Lembrete de prova — hoje!</h2>
      <p>Olá, {{responsible_name}}!</p>
      <p>A prova de <strong>{{student_name}}</strong> na <strong>{{unit_name}}</strong> está marcada para <strong>hoje</strong>, às <strong>{{exam_time}}</strong>.</p>
      <p>Compareça com documento de identificação. Boa sorte!</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
    </div>',
    false, 0, 7, 0
  ),
  -- Follow-up pós atendimento (1 dia)
  (
    NULL,
    'post_attendance_followup',
    'Follow-up pós atendimento (padrão)',
    'Como foi o atendimento de {{student_name}}?',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Obrigado pela visita!</h2>
      <p>Olá, {{responsible_name}}!</p>
      <p>Esperamos que o atendimento de <strong>{{student_name}}</strong> na <strong>{{unit_name}}</strong> tenha sido uma ótima experiência.</p>
      <p>Ficamos à disposição para esclarecer qualquer dúvida sobre o processo seletivo ou as condições de matrícula.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
    </div>',
    false, 0, 9, 0
  ),
  -- Comunicação de valor pedagógico (3 dias após atendimento)
  (
    NULL,
    'post_attendance_3_days',
    'Valor pedagógico 3 dias após atendimento (padrão)',
    'Projeto pedagógico da {{unit_name}} — conheça mais',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Olá, {{responsible_name}}!</h2>
      <p>Faz alguns dias desde o atendimento de <strong>{{student_name}}</strong> e gostaríamos de compartilhar mais sobre nossa proposta pedagógica.</p>
      <p>Na <strong>{{unit_name}}</strong>, acreditamos que cada aluno tem um ritmo único de aprendizado. Nossa equipe está preparada para acompanhar o desenvolvimento de {{student_name}} em todas as etapas.</p>
      <p>Restam dúvidas? Entre em contato — ficaremos felizes em ajudar!</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
    </div>',
    false, 0, 9, 0
  ),
  -- Matrícula concluída
  (
    NULL,
    'matricula_concluida',
    'Matrícula concluída (padrão)',
    'Parabéns! Matrícula de {{student_name}} confirmada na {{unit_name}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">🎉 Matrícula confirmada!</h2>
      <p>Olá, {{responsible_name}}!</p>
      <p>Temos o prazer de confirmar a matrícula de <strong>{{student_name}}</strong> na <strong>{{unit_name}}</strong>.</p>
      <p>Bem-vindo(a) à nossa família! Em breve entraremos em contato com as informações sobre o início das aulas e os materiais necessários.</p>
      <p><strong>Turma:</strong> {{class_name}}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
    </div>',
    false, 0, 8, 0
  ),
  -- [INTERNO] Inscrito novo sem atendimento
  (
    NULL,
    'staff_new_lead_no_appointment',
    '[INTERNO] Inscrito sem agendamento 24h (padrão)',
    '[INTERNO] Lead sem agendamento: {{student_name}} ({{unit_name}})',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #f59e0b; padding-left: 16px;">
      <h2 style="color: #92400e;">[ALERTA INTERNO] Lead sem agendamento</h2>
      <p>O inscrito abaixo está há mais de 24 horas sem agendamento:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 8px;font-weight:bold;">Aluno:</td><td style="padding:4px 8px;">{{student_name}}</td></tr>
        <tr style="background:#fef3c7;"><td style="padding:4px 8px;font-weight:bold;">Responsável:</td><td style="padding:4px 8px;">{{responsible_name}}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Unidade:</td><td style="padding:4px 8px;">{{unit_name}}</td></tr>
        <tr style="background:#fef3c7;"><td style="padding:4px 8px;font-weight:bold;">Telefone:</td><td style="padding:4px 8px;">{{unit_phone}}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Status:</td><td style="padding:4px 8px;">Nenhum agendamento</td></tr>
        <tr style="background:#fef3c7;"><td style="padding:4px 8px;font-weight:bold;">Código:</td><td style="padding:4px 8px;">{{tracking_code}}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;">Este é um e-mail automático interno. Não compartilhe com o responsável.</p>
    </div>',
    false, 0, 8, 0
  ),
  -- [INTERNO] Faltou ao atendimento e não reagendou
  (
    NULL,
    'staff_missed_appointment_no_reschedule',
    '[INTERNO] Faltou ao atendimento 24h sem reagendar (padrão)',
    '[INTERNO] Faltou e não reagendou: {{student_name}} ({{unit_name}})',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #ef4444; padding-left: 16px;">
      <h2 style="color: #991b1b;">[ALERTA INTERNO] Faltou ao atendimento</h2>
      <p>O inscrito abaixo está há mais de 24 horas no status <strong>Faltou ao Atendimento</strong> sem reagendamento:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 8px;font-weight:bold;">Aluno:</td><td style="padding:4px 8px;">{{student_name}}</td></tr>
        <tr style="background:#fee2e2;"><td style="padding:4px 8px;font-weight:bold;">Responsável:</td><td style="padding:4px 8px;">{{responsible_name}}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Unidade:</td><td style="padding:4px 8px;">{{unit_name}}</td></tr>
        <tr style="background:#fee2e2;"><td style="padding:4px 8px;font-weight:bold;">Telefone:</td><td style="padding:4px 8px;">{{unit_phone}}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Código:</td><td style="padding:4px 8px;">{{tracking_code}}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;">Este é um e-mail automático interno. Não compartilhe com o responsável.</p>
    </div>',
    false, 0, 8, 0
  ),
  -- [INTERNO] Proposta sem retorno
  (
    NULL,
    'staff_proposal_no_response',
    '[INTERNO] Proposta sem retorno 3 dias (padrão)',
    '[INTERNO] Proposta sem retorno: {{student_name}} ({{unit_name}})',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-left: 4px solid #8b5cf6; padding-left: 16px;">
      <h2 style="color: #5b21b6;">[ALERTA INTERNO] Proposta sem retorno</h2>
      <p>O inscrito que você atendeu está há 3 dias no status <strong>Atendido Recentemente</strong> sem evolução:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 8px;font-weight:bold;">Aluno:</td><td style="padding:4px 8px;">{{student_name}}</td></tr>
        <tr style="background:#ede9fe;"><td style="padding:4px 8px;font-weight:bold;">Responsável:</td><td style="padding:4px 8px;">{{responsible_name}}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">Unidade:</td><td style="padding:4px 8px;">{{unit_name}}</td></tr>
        <tr style="background:#ede9fe;"><td style="padding:4px 8px;font-weight:bold;">Código:</td><td style="padding:4px 8px;">{{tracking_code}}</td></tr>
      </table>
      <p>Considere fazer um follow-up para entender as dúvidas da família.</p>
      <p style="color:#6b7280;font-size:13px;">Este é um e-mail automático interno. Não compartilhe com o responsável.</p>
    </div>',
    false, 0, 8, 0
  )
ON CONFLICT DO NOTHING;
