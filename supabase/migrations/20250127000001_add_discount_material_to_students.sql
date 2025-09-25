-- Adicionar coluna discount_material à tabela students
ALTER TABLE public.students
ADD COLUMN discount_material numeric(5,2) DEFAULT 0;

-- Adicionar comentário para documentar a coluna
COMMENT ON COLUMN public.students.discount_material IS 'Percentual de desconto aplicado especificamente ao material didático (0-100)';
