-- Pacote 1: token de inscrição, RPCs públicas seguras e remoção de SELECT anon amplo

-- 1) Coluna registration_token
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS registration_token uuid;

UPDATE public.students
SET registration_token = gen_random_uuid()
WHERE registration_token IS NULL;

ALTER TABLE public.students
ALTER COLUMN registration_token SET NOT NULL;

ALTER TABLE public.students
ALTER COLUMN registration_token SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_registration_token
ON public.students (registration_token);

-- 2) RPC: inscrição pública (substitui INSERT anon direto)
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
BEGIN
  IF p_payload IS NULL OR p_payload->>'student_name' IS NULL OR p_payload->>'class_id' IS NULL OR p_payload->>'unit_id' IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados obrigatórios ausentes');
  END IF;

  v_additional_phones := COALESCE(p_payload->'additional_phones', '[]'::jsonb);

  INSERT INTO public.students (
    student_name,
    responsible_name,
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
    p_payload->>'responsible_name',
    CASE
      WHEN COALESCE(p_payload->>'birth_date', '') = '' THEN NULL
      ELSE (p_payload->>'birth_date')::date
    END,
    p_payload->>'phone',
    p_payload->>'email',
    NULLIF(p_payload->>'city', ''),
    p_payload->>'neighborhood',
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

-- 3) RPC: slots ocupados (substitui SELECT anon em appointments)
CREATE OR REPLACE FUNCTION public.get_occupied_slots(
  p_date date,
  p_interviewer_ids uuid[]
)
RETURNS TABLE(interviewer_id uuid, appointment_time time)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.interviewer_id,
    a.appointment_time::time
  FROM public.appointments a
  WHERE a.appointment_date = p_date
    AND a.interviewer_id = ANY(p_interviewer_ids)
    AND COALESCE(a.status, 'scheduled') NOT IN ('cancelled', 'cancelado');
$$;

-- 4) RPC: consultar agendamento do próprio aluno via token
CREATE OR REPLACE FUNCTION public.get_my_appointment(
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
  v_appointment record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND s.registration_token = p_registration_token
      AND s.created_at > NOW() - INTERVAL '30 days'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token de inscrição inválido ou expirado');
  END IF;

  SELECT
    a.id,
    a.appointment_date,
    a.appointment_time,
    a.status
  INTO v_appointment
  FROM public.appointments a
  WHERE a.student_id = p_student_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_appointment.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'has_appointment', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'has_appointment', true,
    'appointment', jsonb_build_object(
      'id', v_appointment.id,
      'appointment_date', v_appointment.appointment_date,
      'appointment_time', v_appointment.appointment_time,
      'status', v_appointment.status
    )
  );
END;
$$;

-- 5) RPC: auto-agendamento com validação de token
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
BEGIN
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
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 6) Permissões das RPCs
REVOKE ALL ON FUNCTION public.register_student(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_occupied_slots(date, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_appointment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_schedule_interview(uuid, uuid, date, time, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_student(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_occupied_slots(date, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_appointment(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_schedule_interview(uuid, uuid, date, time, uuid, text) TO anon, authenticated;

-- 7) Remover políticas anon permissivas
DROP POLICY IF EXISTS "Allow anon select students for signup" ON public.students;
DROP POLICY IF EXISTS "Allow anon insert into students" ON public.students;
DROP POLICY IF EXISTS "Appointments select for anon" ON public.appointments;
