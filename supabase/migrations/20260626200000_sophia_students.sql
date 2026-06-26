-- Cache local de alunos do SophiA para conferência de matrículas

CREATE TABLE IF NOT EXISTS public.sophia_students (
  codigo_externo text NOT NULL,
  nome text NOT NULL,
  periodo_id text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo_externo, periodo_id)
);

CREATE INDEX IF NOT EXISTS sophia_students_periodo_id_idx ON public.sophia_students(periodo_id);
CREATE INDEX IF NOT EXISTS sophia_students_synced_at_idx ON public.sophia_students(synced_at DESC);

CREATE TABLE IF NOT EXISTS public.sophia_sync_meta (
  periodo_id text PRIMARY KEY,
  synced_at timestamptz,
  total_students integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'idle'
);

ALTER TABLE public.sophia_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sophia_sync_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read sophia_students" ON public.sophia_students;
CREATE POLICY "Admin read sophia_students"
ON public.sophia_students
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin());

DROP POLICY IF EXISTS "Admin read sophia_sync_meta" ON public.sophia_sync_meta;
CREATE POLICY "Admin read sophia_sync_meta"
ON public.sophia_sync_meta
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin());

GRANT SELECT ON public.sophia_students TO authenticated;
GRANT SELECT ON public.sophia_sync_meta TO authenticated;
