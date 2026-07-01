-- public_interviewer_profiles: aplicar RLS via security_invoker (mesmo padrão de staff_directory).
-- A view expõe só id + nome de entrevistadores/direção/admin ativos para autoagendamento público.

DROP VIEW IF EXISTS public.public_interviewer_profiles;

CREATE VIEW public.public_interviewer_profiles
WITH (security_invoker = true)
AS
SELECT id, name
FROM public.profiles
WHERE ativo = true
  AND profile IN (
    'entrevistador'::public.user_profile,
    'direcao'::public.user_profile,
    'admin'::public.user_profile
  );

GRANT SELECT ON public.public_interviewer_profiles TO anon, authenticated;

-- Anon precisa de colunas mínimas em profiles para security_invoker; RLS limita às linhas públicas.
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT (id, name) ON public.profiles TO anon;

DROP POLICY IF EXISTS "Profiles select public interviewers" ON public.profiles;

CREATE POLICY "Profiles select public interviewers"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  ativo = true
  AND profile IN (
    'entrevistador'::public.user_profile,
    'direcao'::public.user_profile,
    'admin'::public.user_profile
  )
);

COMMENT ON VIEW public.public_interviewer_profiles IS
  'Entrevistadores ativos (id, nome) para fluxos públicos. RLS via security_invoker + policy em profiles.';
