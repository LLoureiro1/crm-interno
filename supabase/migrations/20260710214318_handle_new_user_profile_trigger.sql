-- Vincula auth.users → public.profiles automaticamenteamente na criação do usuário.
-- Metadados esperados em raw_user_meta_data: name, profile, unit_id
-- (enviados por create-user-invite / admin.createUser).

-- Garante FK profiles.id → auth.users(id) ON DELETE CASCADE (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = cols.attnum
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND c.contype = 'f'
      AND a.attname = 'id'
      AND c.confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta_name text;
  meta_profile text;
  meta_unit_id text;
  resolved_name text;
  resolved_profile public.user_profile;
  resolved_unit_id uuid;
BEGIN
  meta_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'name', '')), '');
  meta_profile := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'profile', '')), '');
  meta_unit_id := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'unit_id', '')), '');

  resolved_name := COALESCE(
    meta_name,
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'Usuário'
  );

  -- Perfil: só aceita valores do enum; default seguro = padrao
  -- (user_metadata é editável pelo usuário — não usar como fonte de autorização depois do signup)
  IF meta_profile IN ('admin', 'direcao', 'entrevistador', 'padrao') THEN
    resolved_profile := meta_profile::public.user_profile;
  ELSE
    resolved_profile := 'padrao'::public.user_profile;
  END IF;

  resolved_unit_id := NULL;
  IF meta_unit_id IS NOT NULL AND meta_unit_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    resolved_unit_id := meta_unit_id::uuid;
    -- Ignora unit_id inexistente para não bloquear criação do auth user
    IF NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id = resolved_unit_id) THEN
      resolved_unit_id := NULL;
    END IF;
  END IF;

  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RAISE EXCEPTION 'auth.users.email is required to create public.profiles';
  END IF;

  INSERT INTO public.profiles (id, name, email, profile, unit_id, ativo)
  VALUES (
    NEW.id,
    resolved_name,
    lower(trim(NEW.email)),
    resolved_profile,
    resolved_unit_id,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Espelha unit_id primária em profile_units (quando houver)
  IF resolved_unit_id IS NOT NULL THEN
    INSERT INTO public.profile_units (profile_id, unit_id)
    VALUES (NEW.id, resolved_unit_id)
    ON CONFLICT (profile_id, unit_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria linha em public.profiles (e profile_units) ao inserir em auth.users.';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
