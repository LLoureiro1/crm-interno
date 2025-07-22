-- Remove a coluna city_id da tabela units e adiciona coluna city como texto
ALTER TABLE public.units 
DROP COLUMN IF EXISTS city_id;

ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS city TEXT;