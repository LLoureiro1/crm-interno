-- Enable RLS and add policies for student_interactions table
ALTER TABLE public.student_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student interactions select by unit" ON public.student_interactions;
DROP POLICY IF EXISTS "Student interactions insert by unit" ON public.student_interactions;

CREATE POLICY "Student interactions select by unit"
ON public.student_interactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.student_interactions.student_id
      AND public.user_has_student_access(s.unit_id)
  )
);

CREATE POLICY "Student interactions insert by unit"
ON public.student_interactions
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() OR user_id IS NULL)
  AND EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = public.student_interactions.student_id
      AND public.user_has_student_access(s.unit_id)
  )
);
