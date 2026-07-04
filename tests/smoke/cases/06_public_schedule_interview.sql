DO $$
DECLARE
  v_unit_id uuid;
  v_series_id uuid;
  v_class_id uuid;
  v_student_id uuid;
  v_token uuid := gen_random_uuid();
  v_interviewer_id uuid := gen_random_uuid();
  v_result jsonb;
  v_future_date date := CURRENT_DATE + 7;
BEGIN
  INSERT INTO public.units (name) VALUES ('Unidade smoke agendamento') RETURNING id INTO v_unit_id;
  INSERT INTO public.series (name, unit_id) VALUES ('8º ano', v_unit_id) RETURNING id INTO v_series_id;
  INSERT INTO public.classes (name, unit_id, series_id)
    VALUES ('Turma C', v_unit_id, v_series_id)
    RETURNING id INTO v_class_id;

  INSERT INTO public.students (
    student_name, responsible_name, phone, email, city, neighborhood,
    origin_school, birth_date, class_id, unit_id, status, registration_token, created_at
  ) VALUES (
    'Aluno Agendamento', 'Resp', '11999999993', 'agenda@smoke.test',
    'São Paulo', 'Centro', 'Escola', '2010-01-01', v_class_id, v_unit_id,
    'nenhum_agendamento', v_token, now()
  ) RETURNING id INTO v_student_id;

  v_result := public.public_schedule_interview(
    v_student_id, v_interviewer_id, v_future_date, '10:00'::time,
    gen_random_uuid(), NULL
  );
  PERFORM smoke_test.assert_true(NOT (v_result->>'success')::boolean, 'token inválido deve falhar');
  PERFORM smoke_test.assert_eq(
    v_result->>'error',
    'Token de inscrição inválido ou expirado',
    'mensagem de token inválido'
  );

  UPDATE public.students SET status = 'matriculado' WHERE id = v_student_id;
  v_result := public.public_schedule_interview(
    v_student_id, v_interviewer_id, v_future_date, '10:00'::time, v_token, NULL
  );
  PERFORM smoke_test.assert_true(NOT (v_result->>'success')::boolean, 'matriculado não pode agendar');
  PERFORM smoke_test.assert_eq(
    v_result->>'error',
    'Status do aluno não permite agendamento',
    'mensagem de status inelegível'
  );

  UPDATE public.students SET status = 'nenhum_agendamento' WHERE id = v_student_id;
  v_result := public.public_schedule_interview(
    v_student_id, v_interviewer_id, v_future_date, '10:00'::time, v_token, NULL
  );
  PERFORM smoke_test.assert_true((v_result->>'success')::boolean, 'agendamento válido deve passar');
  PERFORM smoke_test.assert_eq(
    (SELECT status::text FROM public.students WHERE id = v_student_id),
    'atendimento_agendado',
    'status deve mudar após agendamento'
  );
  PERFORM smoke_test.assert_true(
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE student_id = v_student_id AND status = 'scheduled'
    ),
    'deve criar appointment scheduled'
  );
  PERFORM smoke_test.assert_true(
    EXISTS (
      SELECT 1 FROM public.student_interactions
      WHERE student_id = v_student_id AND interaction_type = 'agendamento_entrevista'
    ),
    'deve registrar interação de agendamento'
  );
END;
$$;
