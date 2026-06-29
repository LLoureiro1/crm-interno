-- Garante validate_strong_password e acesso para o runner de smoke tests
CREATE OR REPLACE FUNCTION public.validate_strong_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_password IS NULL OR length(p_password) < 12 THEN
    RETURN false;
  END IF;

  IF p_password !~ '[A-Z]' THEN
    RETURN false;
  END IF;

  IF p_password !~ '[a-z]' THEN
    RETURN false;
  END IF;

  IF p_password !~ '[0-9]' THEN
    RETURN false;
  END IF;

  IF p_password !~ '[^A-Za-z0-9]' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_strong_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_strong_password(text) TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION smoke_test.password_is_strong(p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.validate_strong_password(p_password);
$$;

REVOKE ALL ON FUNCTION smoke_test.password_is_strong(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION smoke_test.password_is_strong(text) TO postgres, service_role;
