-- Sessões de usuário: login, horário e encerramento (manual ou automático)

DO $$ BEGIN
  CREATE TYPE public.user_session_end_reason AS ENUM (
    'manual',
    'session_expired',
    'inactive_account'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  logged_out_at timestamptz,
  logout_reason public.user_session_end_reason,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT user_sessions_logout_consistency CHECK (
    (logged_out_at IS NULL AND logout_reason IS NULL)
    OR (logged_out_at IS NOT NULL AND logout_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_logged_in_at_idx ON public.user_sessions(logged_in_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_open_idx ON public.user_sessions(user_id) WHERE logged_out_at IS NULL;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own sessions" ON public.user_sessions;
CREATE POLICY "Users insert own sessions"
ON public.user_sessions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users close own open sessions" ON public.user_sessions;
CREATE POLICY "Users close own open sessions"
ON public.user_sessions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND logged_out_at IS NULL)
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff read user sessions" ON public.user_sessions;
CREATE POLICY "Staff read user sessions"
ON public.user_sessions
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

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
