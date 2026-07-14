-- Novo status operacional: Portfólio Enviado
ALTER TYPE public.student_status ADD VALUE IF NOT EXISTS 'portfolio_enviado';
