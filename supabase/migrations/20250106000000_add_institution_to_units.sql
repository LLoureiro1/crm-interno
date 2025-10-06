-- Migration: Add institution support to units table
-- Criar índice para performance na coluna institution_id

-- 1. Criar índice para melhorar performance das queries por instituição
CREATE INDEX IF NOT EXISTS idx_units_institution_id ON public.units(institution_id);

-- 2. Script para atualizar dados - associar cada unidade à sua instituição
-- IMPORTANTE: Ajuste os IDs abaixo com os valores reais das suas instituições

-- Exemplo de como atualizar (descomente e ajuste com seus dados reais):
/*
-- Supondo que você tenha duas instituições:
-- Institution 1: ID = 'uuid-da-instituicao-1'
-- Institution 2: ID = 'uuid-da-instituicao-2'

-- Atualizar unidades da Instituição 1
UPDATE public.units 
SET institution_id = 'uuid-da-instituicao-1'
WHERE name IN ('Nome Unidade 1', 'Nome Unidade 2', 'Nome Unidade 3');

-- Atualizar unidades da Instituição 2
UPDATE public.units 
SET institution_id = 'uuid-da-instituicao-2'
WHERE name IN ('Nome Unidade 4', 'Nome Unidade 5');
*/

-- OU atualizar por cidade/região se aplicável:
/*
UPDATE public.units 
SET institution_id = 'uuid-da-instituicao-1'
WHERE city = 'São Paulo';

UPDATE public.units 
SET institution_id = 'uuid-da-instituicao-2'
WHERE city = 'Rio de Janeiro';
*/

-- 3. Adicionar constraint para garantir integridade (opcional, mas recomendado)
-- Descomente após associar todas as unidades às instituições:
/*
ALTER TABLE public.units 
ALTER COLUMN institution_id SET NOT NULL;
*/

-- 4. Comentário de documentação
COMMENT ON COLUMN public.units.institution_id IS 'ID da instituição à qual a unidade pertence';
COMMENT ON INDEX idx_units_institution_id IS 'Índice para otimizar queries de filtro por instituição';

