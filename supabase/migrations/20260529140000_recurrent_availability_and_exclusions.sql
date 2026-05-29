-- =============================================================================
-- Migração: Criação de tabelas de disponibilidade recorrente e exclusões
-- =============================================================================

-- 1) Tabela interviewer_recurrent_availability
CREATE TABLE IF NOT EXISTS public.interviewer_recurrent_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  class_ids uuid[] DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT recurrent_time_check CHECK (start_time < end_time)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_recurrent_avail_interviewer ON public.interviewer_recurrent_availability(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_recurrent_avail_unit ON public.interviewer_recurrent_availability(unit_id);
CREATE INDEX IF NOT EXISTS idx_recurrent_avail_day_of_week ON public.interviewer_recurrent_availability(day_of_week);

-- Habilitar RLS
ALTER TABLE public.interviewer_recurrent_availability ENABLE ROW LEVEL SECURITY;

-- 2) Tabela availability_exclusions
CREATE TABLE IF NOT EXISTS public.availability_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE, -- NULL significa global (todas as unidades)
  interviewer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL significa global (todos os entrevistadores)
  exclusion_date date NOT NULL,
  start_time time DEFAULT NULL, -- NULL significa o dia todo
  end_time time DEFAULT NULL, -- NULL significa o dia todo
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT exclusion_time_check CHECK (
    (start_time IS NULL AND end_time IS NULL) OR 
    (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_exclusions_date ON public.availability_exclusions(exclusion_date);
CREATE INDEX IF NOT EXISTS idx_exclusions_unit ON public.availability_exclusions(unit_id);
CREATE INDEX IF NOT EXISTS idx_exclusions_interviewer ON public.availability_exclusions(interviewer_id);

-- Habilitar RLS
ALTER TABLE public.availability_exclusions ENABLE ROW LEVEL SECURITY;

-- 3) Permissões de acesso
GRANT SELECT ON public.interviewer_recurrent_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.interviewer_recurrent_availability TO authenticated;

GRANT SELECT ON public.availability_exclusions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.availability_exclusions TO authenticated;

-- 4) Políticas de RLS para interviewer_recurrent_availability
DROP POLICY IF EXISTS "Interviewer recurrent availability select for all" ON public.interviewer_recurrent_availability;
CREATE POLICY "Interviewer recurrent availability select for all"
ON public.interviewer_recurrent_availability
FOR SELECT
TO anon, authenticated
USING (true);
-- Helper: quem pode alterar disponibilidade de entrevistadores
CREATE OR REPLACE FUNCTION public.user_can_modify_interviewer_availability(
  p_availability_unit_id uuid,
  p_interviewer_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND (
        p.profile = 'admin'::public.user_profile
        OR (
          public.user_has_student_access(p_availability_unit_id)
          AND (
            p.profile = 'direcao'::public.user_profile
            OR (
              p.profile = 'entrevistador'::public.user_profile
              AND p.id = p_interviewer_id
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_modify_interviewer_availability(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_modify_interviewer_availability(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Interviewer recurrent availability modify by unit and role" ON public.interviewer_recurrent_availability;
CREATE POLICY "Interviewer recurrent availability modify by unit and role"
ON public.interviewer_recurrent_availability
FOR ALL
TO authenticated
USING (
  public.user_can_modify_interviewer_availability(unit_id, interviewer_id)
)
WITH CHECK (
  public.user_can_modify_interviewer_availability(unit_id, interviewer_id)
);

-- 5) Helper de segurança para exclusões
CREATE OR REPLACE FUNCTION public.user_can_modify_exclusion(
  p_unit_id uuid,
  p_interviewer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND (
        p.profile = 'admin'::public.user_profile
        OR (
          p_unit_id IS NOT NULL 
          AND public.user_has_student_access(p_unit_id)
          AND (
            p.profile = 'direcao'::public.user_profile
            OR (
              p.profile = 'entrevistador'::public.user_profile
              AND (p_interviewer_id IS NULL OR p.id = p_interviewer_id)
            )
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_modify_exclusion(uuid, uuid) TO authenticated;

-- 6) Políticas de RLS para availability_exclusions
DROP POLICY IF EXISTS "Availability exclusions select for all" ON public.availability_exclusions;
CREATE POLICY "Availability exclusions select for all"
ON public.availability_exclusions
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Availability exclusions modify by unit and role" ON public.availability_exclusions;
CREATE POLICY "Availability exclusions modify by unit and role"
ON public.availability_exclusions
FOR ALL
TO authenticated
USING (
  public.user_can_modify_exclusion(unit_id, interviewer_id)
)
WITH CHECK (
  public.user_can_modify_exclusion(unit_id, interviewer_id)
);
