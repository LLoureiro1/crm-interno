CREATE OR REPLACE FUNCTION public_schedule_interview(
  p_student_id UUID,
  p_interviewer_id UUID,
  p_date DATE,
  p_time TIME,
  p_comments TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id UUID;
BEGIN
  -- 1. Insert Appointment
  INSERT INTO appointments (
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

  -- 2. Update Student
  UPDATE students
  SET 
    status = 'atendimento_agendado',
    interview_date = p_date
  WHERE id = p_student_id;

  -- 3. Insert Interaction
  INSERT INTO student_interactions (
    student_id,
    user_id,
    interaction_type,
    comments
  ) VALUES (
    p_student_id,
    NULL, -- Anonymous user / System
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
