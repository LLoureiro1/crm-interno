-- Script para inserir dados iniciais no banco de dados
-- Execute este script no SQL Editor do Supabase Dashboard

-- Verificar se já existem dados
SELECT 'Séries existentes:' as info, count(*) as count FROM public.series;
SELECT 'Unidades existentes:' as info, count(*) as count FROM public.units;

-- Inserir dados iniciais para séries (apenas se não existirem)
INSERT INTO public.series (id, name, level, created_at) VALUES
  (gen_random_uuid(), '1º Ano', 'fundamental', now()),
  (gen_random_uuid(), '2º Ano', 'fundamental', now()),
  (gen_random_uuid(), '3º Ano', 'fundamental', now()),
  (gen_random_uuid(), '4º Ano', 'fundamental', now()),
  (gen_random_uuid(), '5º Ano', 'fundamental', now()),
  (gen_random_uuid(), '6º Ano', 'fundamental', now()),
  (gen_random_uuid(), '7º Ano', 'fundamental', now()),
  (gen_random_uuid(), '8º Ano', 'fundamental', now()),
  (gen_random_uuid(), '9º Ano', 'fundamental', now()),
  (gen_random_uuid(), '1º Ano EM', 'medio', now()),
  (gen_random_uuid(), '2º Ano EM', 'medio', now()),
  (gen_random_uuid(), '3º Ano EM', 'medio', now())
ON CONFLICT (name) DO NOTHING;

-- Inserir dados iniciais para unidades (apenas se não existirem)
INSERT INTO public.units (id, name, address, created_at) VALUES
  (gen_random_uuid(), 'Unidade Centro', 'Rua Central, 123', now()),
  (gen_random_uuid(), 'Unidade Norte', 'Av. Norte, 456', now()),
  (gen_random_uuid(), 'Unidade Sul', 'Rua Sul, 789', now())
ON CONFLICT (name) DO NOTHING;

-- Verificar dados inseridos
SELECT 'Séries após inserção:' as info, count(*) as count FROM public.series;
SELECT 'Unidades após inserção:' as info, count(*) as count FROM public.units;

-- Listar séries inseridas
SELECT 'Séries disponíveis:' as info, name, level FROM public.series ORDER BY name;
SELECT 'Unidades disponíveis:' as info, name, address FROM public.units ORDER BY name;
