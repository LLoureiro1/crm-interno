-- Impede agendamento em horários já passados no dia atual

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
  IF p_date = CURRENT_DATE AND p_time < LOCALTIME THEN
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
GRANT EXECUTE ON FUNCTION public.public_schedule_interview(uuid, uuid, date, time, uuid, text) TO anon, authenticated;
