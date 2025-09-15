-- Script de teste para a nova funcionalidade de marcar alunos como "faltou_ao_atendimento"
-- Execute este script no painel do Supabase para testar

-- 1. Criar um aluno de teste com entrevista no passado
INSERT INTO public.students (
  id,
  student_name,
  responsible_name,
  phone,
  email,
  city,
  neighborhood,
  origin_school,
  birth_date,
  class_id,
  unit_id,
  status,
  interview_date,
  created_at
) VALUES (
  gen_random_uuid(),
  'Aluno Teste Entrevista',
  'Responsável Teste',
  '11999999999',
  'teste.entrevista@exemplo.com',
  'São Paulo',
  'Centro',
  'Escola Teste',
  '2010-01-01',
  (SELECT id FROM public.classes LIMIT 1),
  (SELECT id FROM public.units LIMIT 1),
  'atendimento_agendado',
  '2025-09-10', -- Data no passado
  now()
);

-- 2. Verificar se o aluno foi criado
SELECT 
  id,
  student_name,
  status,
  interview_date,
  created_at
FROM public.students 
WHERE student_name = 'Aluno Teste Entrevista';

-- 3. Verificar se não há appointments "realizado" para este aluno
SELECT 
  a.id,
  a.student_id,
  a.appointment_date,
  a.status,
  s.student_name
FROM public.appointments a
JOIN public.students s ON s.id = a.student_id
WHERE s.student_name = 'Aluno Teste Entrevista';

-- 4. Executar a função manualmente (simular chamada da Edge Function)
-- Nota: Esta parte deve ser executada através do botão "Atualizar Status" no StudentsTab
-- ou através de uma chamada HTTP para a Edge Function

-- 5. Verificar se o status foi alterado após executar a função
SELECT 
  id,
  student_name,
  status,
  interview_date
FROM public.students 
WHERE student_name = 'Aluno Teste Entrevista';

-- 6. Verificar se foi criado um registro de interação
SELECT 
  si.id,
  si.student_id,
  si.interaction_type,
  si.comments,
  si.created_at,
  s.student_name
FROM public.student_interactions si
JOIN public.students s ON s.id = si.student_id
WHERE s.student_name = 'Aluno Teste Entrevista'
ORDER BY si.created_at DESC;

-- 7. Limpeza: Remover dados de teste (execute após o teste)
-- DELETE FROM public.student_interactions 
-- WHERE student_id IN (
--   SELECT id FROM public.students WHERE student_name = 'Aluno Teste Entrevista'
-- );
-- 
-- DELETE FROM public.students 
-- WHERE student_name = 'Aluno Teste Entrevista';
