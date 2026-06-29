DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.compute_student_engagement_score(gen_random_uuid());
  PERFORM smoke_test.assert_eq(v_count::text, '0', 'aluno inexistente não deve retornar linhas');
END;
$$;
