-- Bootstrap P1: inscrição pública, transições de status e autoagendamento.
-- Depende de 01_minimal_schema.sql e 02_validate_cpf.sql.

CREATE TYPE public.dropout_reason AS ENUM (
  'impossibilidade_contato',
  'mudanca_de_endereco',
  'matriculou_outra_escola',
  'motivos_financeiros',
  'falta_vaga',
  'outro'
);

CREATE TYPE public.invalid_reason AS ENUM (
  'cadastro_duplicado',
  'cadastro_de_teste',
  'ja_e_aluno'
);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS responsible_cpf text,
  ADD COLUMN IF NOT EXISTS registration_token uuid,
  ADD COLUMN IF NOT EXISTS interview_date date,
  ADD COLUMN IF NOT EXISTS registration_source_id uuid,
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS exam_date_id uuid,
  ADD COLUMN IF NOT EXISTS exam_date date,
  ADD COLUMN IF NOT EXISTS dropout_reason public.dropout_reason,
  ADD COLUMN IF NOT EXISTS invalid_reason public.invalid_reason,
  ADD COLUMN IF NOT EXISTS codigo_erp text;

ALTER TABLE public.student_interactions
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS comments text;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS interviewer_id uuid,
  ADD COLUMN IF NOT EXISTS formato_entrevista text;

CREATE TABLE IF NOT EXISTS public.registration_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip inet NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_rate_limits_ip_created
  ON public.registration_rate_limits (client_ip, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.register_student(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_student_id uuid;
  v_additional_phones jsonb;
  v_phone text;
  v_ip_raw text;
  v_ip inet;
  v_recent_count integer;
  v_responsible_cpf text;
BEGIN
  IF COALESCE(trim(p_payload->>'website'), '') <> '' THEN
    RETURN jsonb_build_object(
      'success', true,
      'id', gen_random_uuid(),
      'registration_token', gen_random_uuid()
    );
  END IF;

  IF p_payload IS NULL
    OR p_payload->>'student_name' IS NULL
    OR p_payload->>'class_id' IS NULL
    OR p_payload->>'unit_id' IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados obrigatórios ausentes');
  END IF;

  v_responsible_cpf := regexp_replace(COALESCE(p_payload->>'responsible_cpf', ''), '\D', '', 'g');

  IF v_responsible_cpf <> '' AND NOT public.validate_cpf(v_responsible_cpf) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CPF do responsável inválido');
  END IF;

  BEGIN
    v_ip_raw := COALESCE(
      nullif(trim(split_part(
        COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1
      )), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'x-real-ip'), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'cf-connecting-ip'), '')
    );

    IF v_ip_raw IS NOT NULL THEN
      v_ip := v_ip_raw::inet;

      SELECT count(*)::integer INTO v_recent_count
      FROM public.registration_rate_limits
      WHERE client_ip = v_ip
        AND created_at > now() - interval '1 hour';

      IF v_recent_count >= 15 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Muitas inscrições em pouco tempo. Tente novamente mais tarde.'
        );
      END IF;

      INSERT INTO public.registration_rate_limits (client_ip) VALUES (v_ip);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  v_additional_phones := COALESCE(p_payload->'additional_phones', '[]'::jsonb);

  INSERT INTO public.students (
    student_name,
    responsible_name,
    responsible_cpf,
    birth_date,
    phone,
    email,
    city,
    neighborhood,
    origin_school,
    class_id,
    unit_id,
    registration_source_id,
    tracking_code,
    status,
    exam_date_id,
    exam_date,
    registration_token
  ) VALUES (
    p_payload->>'student_name',
    COALESCE(p_payload->>'responsible_name', 'Responsável'),
    NULLIF(v_responsible_cpf, ''),
    CASE
      WHEN COALESCE(p_payload->>'birth_date', '') = '' THEN '2010-01-01'::date
      ELSE (p_payload->>'birth_date')::date
    END,
    COALESCE(p_payload->>'phone', '11999999999'),
    COALESCE(p_payload->>'email', 'teste@smoke.local'),
    COALESCE(NULLIF(p_payload->>'city', ''), 'São Paulo'),
    COALESCE(p_payload->>'neighborhood', 'Centro'),
    COALESCE(p_payload->>'origin_school', ''),
    (p_payload->>'class_id')::uuid,
    (p_payload->>'unit_id')::uuid,
    CASE
      WHEN COALESCE(p_payload->>'registration_source_id', '') = '' THEN NULL
      ELSE (p_payload->>'registration_source_id')::uuid
    END,
    NULLIF(p_payload->>'tracking_code', ''),
    COALESCE(p_payload->>'status', 'nenhum_agendamento')::public.student_status,
    CASE
      WHEN COALESCE(p_payload->>'exam_date_id', '') = '' THEN NULL
      ELSE (p_payload->>'exam_date_id')::uuid
    END,
    CASE
      WHEN COALESCE(p_payload->>'exam_date', '') = '' THEN NULL
      ELSE (p_payload->>'exam_date')::date
    END,
    v_token
  )
  RETURNING id INTO v_student_id;

  IF jsonb_typeof(v_additional_phones) = 'array' AND jsonb_array_length(v_additional_phones) > 0 THEN
    FOR v_phone IN
      SELECT trim(value)
      FROM jsonb_array_elements_text(v_additional_phones) AS value
    LOOP
      IF length(regexp_replace(v_phone, '\D', '', 'g')) IN (10, 11) THEN
        INSERT INTO public.student_phones (student_id, phone_number)
        VALUES (v_student_id, v_phone);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_student_id,
    'registration_token', v_token::text
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_student(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_student(jsonb) TO anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.public_schedule_interview(
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
  v_now_brt timestamp;
  v_today_brt date;
  v_time_brt time;
BEGIN
  v_now_brt := timezone('America/Sao_Paulo', now());
  v_today_brt := v_now_brt::date;
  v_time_brt := v_now_brt::time;

  IF p_date < v_today_brt OR (p_date = v_today_brt AND p_time < v_time_brt) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Horário no passado. Escolha um horário futuro.'
    );
  END IF;

  SELECT s.id, s.unit_id, s.status
  INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.registration_token = p_registration_token
    AND s.created_at > NOW() - INTERVAL '30 days';

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token de inscrição inválido ou expirado'
    );
  END IF;

  IF v_student.status NOT IN ('nenhum_agendamento', 'faltou_ao_atendimento') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Status do aluno não permite agendamento'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.student_id = p_student_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aluno já possui agendamento'
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
    interview_date = p_date
  WHERE id = p_student_id;

  INSERT INTO public.student_interactions (
    student_id,
    user_id,
    interaction_type,
    comments
  ) VALUES (
    p_student_id,
    NULL,
    'agendamento_entrevista',
    COALESCE(p_comments, 'Agendamento realizado via auto-agendamento (público)')
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

REVOKE ALL ON FUNCTION public.public_schedule_interview(uuid, uuid, date, time, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_schedule_interview(uuid, uuid, date, time, uuid, text) TO anon, authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION public.check_matriculado_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'matriculado' THEN
    IF NEW.status NOT IN ('matriculado', 'desistente', 'cadastro_invalido') THEN
      RAISE EXCEPTION 'Estudantes matriculados só podem alterar status para Desistente ou Cadastro Inválido.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_matriculado_status_change ON public.students;
CREATE TRIGGER trg_check_matriculado_status_change
  BEFORE UPDATE OF status ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.check_matriculado_status_change();
