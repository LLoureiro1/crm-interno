-- Remove o trigger legado que sobrescrevia exam_date_id (nome diferente do trg_auto_assign_exam_date)

DROP TRIGGER IF EXISTS trg_auto_assign_exam_date_after ON public.students;
DROP TRIGGER IF EXISTS trg_auto_assign_exam_date ON public.students;
DROP FUNCTION IF EXISTS public.auto_assign_exam_date_to_student();
