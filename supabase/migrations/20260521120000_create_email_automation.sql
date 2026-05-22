-- Automação de e-mails transacionais via Google Workspace (Gmail API)

CREATE TYPE public.email_trigger_type AS ENUM (
  'student_registered',
  'appointment_scheduled',
  'appointment_reminder_same_day',
  'exam_reminder_1_day_before'
);

CREATE TYPE public.email_queue_status AS ENUM (
  'pending',
  'sending',
  'sent',
  'failed',
  'cancelled'
);

CREATE TABLE public.email_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  sender_email text NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_integrations_unit_id_key
  ON public.email_integrations (unit_id)
  WHERE unit_id IS NOT NULL;

CREATE UNIQUE INDEX email_integrations_default_key
  ON public.email_integrations ((true))
  WHERE unit_id IS NULL;

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  trigger_type public.email_trigger_type NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  send_offset_days integer NOT NULL DEFAULT 0,
  send_at_hour integer NOT NULL DEFAULT 8 CHECK (send_at_hour >= 0 AND send_at_hour <= 23),
  send_at_minute integer NOT NULL DEFAULT 0 CHECK (send_at_minute >= 0 AND send_at_minute <= 59),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_templates_default_trigger_key
  ON public.email_templates (trigger_type)
  WHERE unit_id IS NULL;

CREATE UNIQUE INDEX email_templates_unit_trigger_key
  ON public.email_templates (unit_id, trigger_type)
  WHERE unit_id IS NOT NULL;

CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  trigger_type public.email_trigger_type NOT NULL,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  html_body text NOT NULL,
  status public.email_queue_status NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  provider_message_id text,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_queue_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX email_queue_pending_scheduled_idx
  ON public.email_queue (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX email_queue_student_id_idx ON public.email_queue (student_id);
CREATE INDEX email_queue_created_at_idx ON public.email_queue (created_at DESC);

ALTER TABLE public.email_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email integrations"
  ON public.email_integrations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.profile = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.profile = 'admin'
    )
  );

CREATE POLICY "Admins manage email templates"
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.profile = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.profile = 'admin'
    )
  );

CREATE POLICY "Admins read email queue"
  ON public.email_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.profile = 'admin'
    )
  );

INSERT INTO public.email_templates (unit_id, trigger_type, name, subject, html_body, send_offset_days, send_at_hour)
VALUES
  (
    NULL,
    'student_registered',
    'Confirmação de inscrição (padrão)',
    'Inscrição confirmada - {{unit_name}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Olá, {{student_name}}!</h2>
      <p>Sua inscrição na <strong>{{unit_name}}</strong> foi recebida com sucesso.</p>
      <p><strong>Código de acompanhamento:</strong> {{tracking_code}}</p>
      <p>Em breve entraremos em contato com os próximos passos do processo seletivo.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
    </div>',
    0,
    8
  ),
  (
    NULL,
    'appointment_scheduled',
    'Confirmação de agendamento (padrão)',
    'Atendimento agendado - {{appointment_date}} às {{appointment_time}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Atendimento confirmado</h2>
      <p>Olá, {{student_name}}!</p>
      <p>Seu atendimento na <strong>{{unit_name}}</strong> foi agendado para:</p>
      <p style="font-size: 18px;"><strong>{{appointment_date}}</strong> às <strong>{{appointment_time}}</strong></p>
      <p>Por favor, chegue com 10 minutos de antecedência.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 14px;">{{unit_name}} — {{unit_address}}, {{unit_city}}<br/>Telefone: {{unit_phone}}</p>
    </div>',
    0,
    8
  ),
  (
    NULL,
    'appointment_reminder_same_day',
    'Lembrete de atendimento no dia (padrão)',
    'Lembrete: seu atendimento é hoje às {{appointment_time}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Lembrete de atendimento</h2>
      <p>Olá, {{student_name}}!</p>
      <p>Este é um lembrete de que seu atendimento na <strong>{{unit_name}}</strong> é <strong>hoje</strong>, às <strong>{{appointment_time}}</strong>.</p>
      <p>Estamos aguardando você!</p>
    </div>',
    0,
    7
  ),
  (
    NULL,
    'exam_reminder_1_day_before',
    'Lembrete de prova 1 dia antes (padrão)',
    'Lembrete: sua prova é amanhã - {{exam_date}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Lembrete de prova</h2>
      <p>Olá, {{student_name}}!</p>
      <p>Sua prova na <strong>{{unit_name}}</strong> está marcada para <strong>amanhã</strong>, dia <strong>{{exam_date}}</strong> às <strong>{{exam_time}}</strong>.</p>
      <p>Compareça com documento de identificação e material necessário.</p>
    </div>',
    -1,
    8
  );

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
  service_key text;
BEGIN
  IF TG_TABLE_NAME = 'students' AND TG_OP = 'INSERT' THEN
    trigger_type := 'student_registered';
  ELSIF TG_TABLE_NAME = 'appointments' AND TG_OP = 'INSERT' THEN
    trigger_type := 'appointment_scheduled';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  service_key := current_setting('app.settings.service_role_key', true);

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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
    body := payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_email_on_student_insert ON public.students;
CREATE TRIGGER trg_email_on_student_insert
  AFTER INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_automation_webhook();

DROP TRIGGER IF EXISTS trg_email_on_student_status_change ON public.students;

DROP TRIGGER IF EXISTS trg_email_on_appointment_insert ON public.appointments;
CREATE TRIGGER trg_email_on_appointment_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_automation_webhook();
