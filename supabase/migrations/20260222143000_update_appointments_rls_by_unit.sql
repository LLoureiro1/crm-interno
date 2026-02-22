-- Atualiza políticas RLS da tabela appointments para respeitar unidade do usuário
-- Regras:
-- 1) Usuário da unidade com slug 'central' vê agendamentos de todas as unidades
-- 2) Usuário autenticado de outra unidade vê apenas agendamentos de alunos da sua unidade
-- 3) Usuário anon continua podendo ler appointments (necessário para auto-agendamento)

-- Garante que RLS está habilitado na tabela appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas de SELECT em appointments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow select for all users'
  ) THEN
    DROP POLICY "Allow select for all users" ON public.appointments;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow select for authenticated'
  ) THEN
    DROP POLICY "Allow select for authenticated" ON public.appointments;
  END IF;
END;
$$;

-- 1) SELECT para usuários anon (auto-agendamento / consultas públicas)
CREATE POLICY "Appointments select for anon"
ON public.appointments
FOR SELECT
TO anon
USING (true);

-- 2) SELECT para usuários autenticados, respeitando unidade
CREATE POLICY "Appointments select by unit and central"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.units u ON u.id = p.unit_id
    LEFT JOIN public.students s ON s.id = public.appointments.student_id
    WHERE p.id = auth.uid()
      AND (
        -- Central vê todos os agendamentos
        u.slug = 'central'
        -- Demais unidades veem apenas agendamentos de alunos da própria unidade
        OR (p.unit_id IS NOT NULL AND s.unit_id IS NOT NULL AND p.unit_id = s.unit_id)
      )
  )
);

