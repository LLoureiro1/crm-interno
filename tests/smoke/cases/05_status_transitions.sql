DO $$
DECLARE
  v_unit_id uuid;
  v_series_id uuid;
  v_class_id uuid;
  v_allowed_id uuid;
  v_blocked_id uuid;
BEGIN
  INSERT INTO public.units (name) VALUES ('Unidade smoke status') RETURNING id INTO v_unit_id;
  INSERT INTO public.series (name, unit_id) VALUES ('7º ano', v_unit_id) RETURNING id INTO v_series_id;
  INSERT INTO public.classes (name, unit_id, series_id)
    VALUES ('Turma B', v_unit_id, v_series_id)
    RETURNING id INTO v_class_id;

  INSERT INTO public.students (
    student_name, responsible_name, phone, email, city, neighborhood,
    origin_school, birth_date, class_id, unit_id, status
  ) VALUES (
    'Aluno Permitido', 'Resp', '11999999991', 'permitido@smoke.test',
    'São Paulo', 'Centro', 'Escola', '2010-01-01', v_class_id, v_unit_id, 'matriculado'
  ) RETURNING id INTO v_allowed_id;

  INSERT INTO public.students (
    student_name, responsible_name, phone, email, city, neighborhood,
    origin_school, birth_date, class_id, unit_id, status
  ) VALUES (
    'Aluno Bloqueado', 'Resp', '11999999992', 'bloqueado@smoke.test',
    'São Paulo', 'Centro', 'Escola', '2010-01-01', v_class_id, v_unit_id, 'matriculado'
  ) RETURNING id INTO v_blocked_id;

  UPDATE public.students
  SET status = 'desistente', dropout_reason = 'outro'
  WHERE id = v_allowed_id;

  PERFORM smoke_test.assert_eq(
    (SELECT status::text FROM public.students WHERE id = v_allowed_id),
    'desistente',
    'matriculado pode ir para desistente'
  );

  BEGIN
    UPDATE public.students SET status = 'nenhum_agendamento' WHERE id = v_blocked_id;
    RAISE EXCEPTION 'SMOKE_TEST_FAIL: transição proibida deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM smoke_test.assert_true(
        SQLERRM LIKE '%só podem alterar status%',
        'matriculado não pode voltar ao funil'
      );
  END;

  PERFORM smoke_test.assert_eq(
    (SELECT status::text FROM public.students WHERE id = v_blocked_id),
    'matriculado',
    'status deve permanecer matriculado após tentativa inválida'
  );
END;
$$;
