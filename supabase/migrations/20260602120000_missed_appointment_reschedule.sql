-- Reagendamento automático após status "faltou_ao_atendimento":
-- e-mail com link público (registration_token) + 1 reagendamento por falta.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS missed_reschedule_used_at timestamptz;

COMMENT ON COLUMN public.students.missed_reschedule_used_at IS
  'Preenchido quando o responsável usa o link de reagendamento após falta (1x por evento de falta).';

-- enum missed_appointment_reschedule: migration 20260602115900
CREATE OR REPLACE FUNCTION public.reset_missed_reschedule_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'faltou_ao_atendimento'
    AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.missed_reschedule_used_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_missed_reschedule ON public.students;
CREATE TRIGGER trg_reset_missed_reschedule
  BEFORE UPDATE OF status ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_missed_reschedule_flag();

-- Valida acesso anônimo à página de reagendamento
CREATE OR REPLACE FUNCTION public.get_reschedule_access(
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
    s.class_id,
    s.missed_reschedule_used_at
  INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.registration_token = p_registration_token;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Link inválido ou expirado'
    );
  END IF;

  IF v_student.status <> 'faltou_ao_atendimento' THEN
    RETURN jsonb_build_object(
      'success', true,
      'eligible', false,
      'reason', 'status_nao_permite',
      'status', v_student.status
    );
  END IF;

  IF v_student.missed_reschedule_used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'eligible', false,
      'reason', 'reagendamento_ja_utilizado',
      'used_at', v_student.missed_reschedule_used_at
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

REVOKE ALL ON FUNCTION public.get_reschedule_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reschedule_access(uuid, uuid) TO anon, authenticated;

-- Reagendamento único: cancela agendamentos anteriores abertos e cria novo
CREATE OR REPLACE FUNCTION public.public_reschedule_after_miss(
  p_student_id uuid,
  p_interviewer_id uuid,
  p_date date,
  p_time time,
  p_registration_token uuid,
  p_comments text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
  v_student record;
BEGIN
  IF p_date = CURRENT_DATE AND p_time < LOCALTIME THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Horário no passado. Escolha um horário futuro.'
    );
  END IF;

  SELECT s.id, s.unit_id, s.status, s.missed_reschedule_used_at
  INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.registration_token = p_registration_token;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Link inválido ou expirado'
    );
  END IF;

  IF v_student.status <> 'faltou_ao_atendimento' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Status do aluno não permite reagendamento'
    );
  END IF;

  IF v_student.missed_reschedule_used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reagendamento online já utilizado. Entre em contato com a unidade.'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.interviewer_id = p_interviewer_id
      AND a.appointment_date = p_date
      AND a.appointment_time = p_time
      AND COALESCE(a.status, 'scheduled') NOT IN ('cancelled', 'cancelado')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Horário indisponível'
    );
  END IF;

  UPDATE public.appointments
  SET status = 'cancelado'
  WHERE student_id = p_student_id
    AND COALESCE(status, 'scheduled') NOT IN ('cancelled', 'cancelado', 'realizado');

  INSERT INTO public.appointments (
    student_id,
    interviewer_id,
    appointment_date,
    appointment_time,
    status,
    formato_entrevista
  ) VALUES (
    p_student_id,
    p_interviewer_id,
    p_date,
    p_time,
    'scheduled',
    'presencial'
  )
  RETURNING id INTO v_appointment_id;

  UPDATE public.students
  SET
    status = 'atendimento_agendado',
    interview_date = p_date,
    missed_reschedule_used_at = now()
  WHERE id = p_student_id;

  INSERT INTO public.student_interactions (
    student_id,
    user_id,
    interaction_type,
    comments
  ) VALUES (
    p_student_id,
    NULL,
    'reagendamento',
    COALESCE(
      p_comments,
      'Reagendamento online após falta ao atendimento'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_reschedule_after_miss(uuid, uuid, date, time, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_reschedule_after_miss(uuid, uuid, date, time, uuid, text) TO anon, authenticated;

-- Webhook: e-mail quando status muda para faltou_ao_atendimento
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

DROP TRIGGER IF EXISTS trg_email_on_student_status_missed ON public.students;
CREATE TRIGGER trg_email_on_student_status_missed
  AFTER UPDATE OF status ON public.students
  FOR EACH ROW
  WHEN (NEW.status = 'faltou_ao_atendimento' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_email_automation_webhook();

-- Template padrão (URL pública configurável via PUBLIC_APP_URL na Edge Function)
INSERT INTO public.email_templates (
  unit_id,
  trigger_type,
  name,
  subject,
  html_body,
  send_offset_days,
  send_at_hour,
  send_at_minute
)
SELECT
  NULL,
  'missed_appointment_reschedule',
  'Reagendamento após falta (padrão)',
  'Reagende seu atendimento - {{unit_name}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1e40af;">Olá, {{responsible_name}}!</h2>
    <p>Notamos que o atendimento agendado para <strong>{{student_name}}</strong> na <strong>{{unit_name}}</strong> não foi realizado.</p>
    <p>Você pode escolher um novo horário online — <strong>apenas uma vez</strong> por este link:</p>
    <p style="margin: 24px 0;">
      <a href="{{reschedule_link}}" style="background:#ea580c;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
        Escolher novo horário
      </a>
    </p>
    <p style="color:#6b7280;font-size:14px;">Se o botão não funcionar, copie e cole no navegador:<br/>{{reschedule_link}}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#6b7280;font-size:14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
  </div>',
  0,
  8,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates
  WHERE trigger_type = 'missed_appointment_reschedule'
    AND unit_id IS NULL
);
