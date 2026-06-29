CREATE OR REPLACE FUNCTION public.validate_cpf(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_cpf text;
  i integer;
  v_sum integer;
  v_mod integer;
  v_digit integer;
BEGIN
  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');

  IF length(v_cpf) <> 11 THEN
    RETURN false;
  END IF;

  IF v_cpf ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;

  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + (substring(v_cpf, i, 1)::integer * (11 - i));
  END LOOP;
  v_mod := v_sum % 11;
  v_digit := CASE WHEN v_mod < 2 THEN 0 ELSE 11 - v_mod END;
  IF v_digit <> substring(v_cpf, 10, 1)::integer THEN
    RETURN false;
  END IF;

  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + (substring(v_cpf, i, 1)::integer * (12 - i));
  END LOOP;
  v_mod := v_sum % 11;
  v_digit := CASE WHEN v_mod < 2 THEN 0 ELSE 11 - v_mod END;

  RETURN v_digit = substring(v_cpf, 11, 1)::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cpf(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cpf(text) TO anon, authenticated, postgres, service_role;
