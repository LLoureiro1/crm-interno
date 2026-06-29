DO $$
BEGIN
  IF to_regprocedure('smoke_test.password_is_strong(text)') IS NULL THEN
    RAISE EXCEPTION 'SMOKE_TEST_FAIL: aplique a migration 20260629140000_smoke_test_password_access.sql';
  END IF;

  PERFORM smoke_test.assert_true(
    smoke_test.password_is_strong('SenhaForte!123'::text),
    'senha forte deve passar'
  );
  PERFORM smoke_test.assert_true(
    NOT smoke_test.password_is_strong('curta'::text),
    'senha curta deve falhar'
  );
  PERFORM smoke_test.assert_true(
    NOT smoke_test.password_is_strong('semnumero!ABC'::text),
    'senha sem número deve falhar'
  );
END;
$$;
