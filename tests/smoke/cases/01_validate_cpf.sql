DO $$
BEGIN
  PERFORM smoke_test.assert_true(public.validate_cpf('52998224725'::text), 'CPF válido deve passar');
  PERFORM smoke_test.assert_true(NOT public.validate_cpf('11111111111'::text), 'CPF com dígitos repetidos deve falhar');
  PERFORM smoke_test.assert_true(NOT public.validate_cpf('123'::text), 'CPF curto deve falhar');
  PERFORM smoke_test.assert_true(NOT public.validate_cpf(NULL::text), 'CPF nulo deve falhar');
END;
$$;
