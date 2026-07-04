DO $$
DECLARE
  v_unit_id uuid;
  v_series_id uuid;
  v_class_id uuid;
  v_result jsonb;
  v_count_before int;
  v_count_after int;
BEGIN
  INSERT INTO public.units (name) VALUES ('Unidade smoke inscrição') RETURNING id INTO v_unit_id;
  INSERT INTO public.series (name, unit_id) VALUES ('6º ano', v_unit_id) RETURNING id INTO v_series_id;
  INSERT INTO public.classes (name, unit_id, series_id, has_exam)
    VALUES ('Turma A', v_unit_id, v_series_id, false)
    RETURNING id INTO v_class_id;

  v_result := public.register_student(jsonb_build_object(
    'student_name', 'Maria Smoke',
    'responsible_name', 'Pai Smoke',
    'phone', '11987654321',
    'email', 'maria@smoke.test',
    'neighborhood', 'Centro',
    'class_id', v_class_id,
    'unit_id', v_unit_id
  ));
  PERFORM smoke_test.assert_true((v_result->>'success')::boolean, 'inscrição válida deve retornar success=true');
  PERFORM smoke_test.assert_true(v_result->>'registration_token' IS NOT NULL, 'deve gerar registration_token');
  PERFORM smoke_test.assert_eq(
    (SELECT status::text FROM public.students WHERE id = (v_result->>'id')::uuid),
    'nenhum_agendamento',
    'turma sem prova deve entrar como nenhum_agendamento'
  );

  v_result := public.register_student(jsonb_build_object(
    'student_name', 'Teste CPF',
    'phone', '11987654321',
    'email', 'cpf@smoke.test',
    'neighborhood', 'Centro',
    'class_id', v_class_id,
    'unit_id', v_unit_id,
    'responsible_cpf', '11111111111'
  ));
  PERFORM smoke_test.assert_true(NOT (v_result->>'success')::boolean, 'CPF inválido deve falhar');
  PERFORM smoke_test.assert_eq(v_result->>'error', 'CPF do responsável inválido', 'mensagem de CPF inválido');

  v_result := public.register_student('{"student_name":"X"}'::jsonb);
  PERFORM smoke_test.assert_true(NOT (v_result->>'success')::boolean, 'payload incompleto deve falhar');
  PERFORM smoke_test.assert_eq(v_result->>'error', 'Dados obrigatórios ausentes', 'mensagem de campos ausentes');

  SELECT count(*)::int INTO v_count_before FROM public.students;
  v_result := public.register_student(jsonb_build_object(
    'website', 'http://spam.bot',
    'student_name', 'Bot',
    'phone', '11987654321',
    'email', 'bot@smoke.test',
    'neighborhood', 'Centro',
    'class_id', v_class_id,
    'unit_id', v_unit_id
  ));
  SELECT count(*)::int INTO v_count_after FROM public.students;
  PERFORM smoke_test.assert_true((v_result->>'success')::boolean, 'honeypot retorna success falso');
  PERFORM smoke_test.assert_eq(v_count_after::text, v_count_before::text, 'honeypot não deve inserir aluno');
END;
$$;
