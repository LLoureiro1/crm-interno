-- Adiciona a coluna student_goal na tabela units para controlar a meta de matrículas
ALTER TABLE public.units ADD COLUMN student_goal integer NOT NULL DEFAULT 0;
