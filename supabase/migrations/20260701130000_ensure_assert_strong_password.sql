-- Garante funções de validação de senha forte (convite / reset de senha)

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
GRANT EXECUTE ON FUNCTION public.validate_strong_password(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_strong_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.validate_strong_password(p_password) THEN
    RAISE EXCEPTION
      'Senha fraca: use pelo menos 12 caracteres com maiúscula, minúscula, número e símbolo.'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_strong_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_strong_password(text) TO authenticated, anon;
