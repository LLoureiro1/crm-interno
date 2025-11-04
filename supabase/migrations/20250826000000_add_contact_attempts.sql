-- Create enum for contact channels
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_channel') THEN
    CREATE TYPE contact_channel AS ENUM ('phone', 'whatsapp', 'email', 'in_person');
  END IF;
END $$;

-- Create contact_attempts table
CREATE TABLE IF NOT EXISTS public.contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attempted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  channel contact_channel NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  comment text,
  related_status student_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_attempts_student_id ON public.contact_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_attempted_at ON public.contact_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_succeeded ON public.contact_attempts(succeeded);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_attempted_by ON public.contact_attempts(attempted_by);

-- Basic RLS setup (optional - adjust as needed)
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  -- Allow select for authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_attempts' AND policyname = 'Allow select for authenticated'
  ) THEN
    CREATE POLICY "Allow select for authenticated" ON public.contact_attempts FOR SELECT TO authenticated USING (true);
  END IF;
  -- Allow insert for authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_attempts' AND policyname = 'Allow insert for authenticated'
  ) THEN
    CREATE POLICY "Allow insert for authenticated" ON public.contact_attempts FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;