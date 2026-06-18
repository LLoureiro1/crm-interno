-- Log de acessos (login, logout, expiração diária) para auditoria em relatórios

CREATE TYPE public.user_auth_action AS ENUM ('login', 'logout', 'session_expired');

CREATE TABLE public.user_auth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action public.user_auth_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX user_auth_logs_user_id_idx ON public.user_auth_logs(user_id);
CREATE INDEX user_auth_logs_created_at_idx ON public.user_auth_logs(created_at DESC);
CREATE INDEX user_auth_logs_action_idx ON public.user_auth_logs(action);

ALTER TABLE public.user_auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own auth logs"
ON public.user_auth_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff read auth logs"
ON public.user_auth_logs
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.profile IN (
        'admin'::public.user_profile,
        'direcao'::public.user_profile
      )
  )
);

GRANT SELECT, INSERT ON public.user_auth_logs TO authenticated;
