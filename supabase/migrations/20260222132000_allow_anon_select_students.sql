ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select students for signup" ON public.students;

CREATE POLICY "Allow anon select students for signup"
ON public.students
FOR SELECT
TO anon
USING (true);
