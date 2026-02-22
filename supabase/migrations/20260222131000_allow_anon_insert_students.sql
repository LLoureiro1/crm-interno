CREATE POLICY "Allow anon insert into students"
ON public.students
FOR INSERT
TO anon
WITH CHECK (true);
