ALTER TABLE public.students
ADD COLUMN exam_date_id UUID REFERENCES public.exam_dates(id) ON DELETE SET NULL; 

-- Opcional: Adicionar um índice para a nova coluna para melhorar o desempenho da consulta
CREATE INDEX IF NOT EXISTS idx_students_exam_date_id ON public.students(exam_date_id);

-- Opcional: Adicionar uma função ou trigger para preencher automaticamente exam_date_id
-- com base na lógica de negócio (ex: o exame mais próximo para a unidade do aluno)
-- Isso exigiria mais detalhes sobre a lógica de atribuição de exames aos alunos.