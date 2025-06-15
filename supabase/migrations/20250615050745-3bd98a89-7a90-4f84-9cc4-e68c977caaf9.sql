
-- Criar tabela para gerenciar datas de provas
CREATE TABLE IF NOT EXISTS public.exam_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_date DATE NOT NULL,
  exam_time TIME NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_exam_dates_date_unit ON public.exam_dates(exam_date, unit_id);

-- Adicionar campo interview_date na tabela students para marcar entrevistas
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS interview_date DATE;

-- Criar índice para o novo campo
CREATE INDEX IF NOT EXISTS idx_students_interview_date ON public.students(interview_date);
