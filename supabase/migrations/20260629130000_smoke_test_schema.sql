-- Harness de smoke tests isolado do schema public (não exposto via Data API)
CREATE SCHEMA IF NOT EXISTS smoke_test;

COMMENT ON SCHEMA smoke_test IS 'Harness, fixtures e log de smoke tests. Separado de public.';

REVOKE ALL ON SCHEMA smoke_test FROM PUBLIC;
REVOKE ALL ON SCHEMA smoke_test FROM anon, authenticated;
GRANT USAGE ON SCHEMA smoke_test TO postgres, service_role;

CREATE TABLE IF NOT EXISTS smoke_test.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite text NOT NULL,
  passed boolean NOT NULL,
  message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE smoke_test.runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE smoke_test.runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE smoke_test.runs TO postgres, service_role;

CREATE OR REPLACE FUNCTION smoke_test.assert_true(p_condition boolean, p_message text DEFAULT 'assertion failed')
RETURNS void
LANGUAGE plpgsql
SET search_path = smoke_test, public
AS $$
BEGIN
  IF NOT p_condition THEN
    RAISE EXCEPTION 'SMOKE_TEST_FAIL: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION smoke_test.assert_eq(p_actual text, p_expected text, p_message text DEFAULT 'values differ')
RETURNS void
LANGUAGE plpgsql
SET search_path = smoke_test, public
AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'SMOKE_TEST_FAIL: % (got %, expected %)', p_message, p_actual, p_expected;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION smoke_test.record_run(
  p_suite text,
  p_passed boolean,
  p_message text DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = smoke_test, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO smoke_test.runs (suite, passed, message, duration_ms)
  VALUES (p_suite, p_passed, p_message, p_duration_ms)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION smoke_test.assert_true(boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION smoke_test.assert_eq(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION smoke_test.record_run(text, boolean, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION smoke_test.assert_true(boolean, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION smoke_test.assert_eq(text, text, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION smoke_test.record_run(text, boolean, text, integer) TO postgres, service_role;
