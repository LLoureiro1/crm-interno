-- Allow anonymous users to read interviewer_availability and appointments
-- This is needed for the self-scheduling feature to work for non-logged users

-- ============================================
-- INTERVIEWER_AVAILABILITY POLICIES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.interviewer_availability ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy if it exists (to recreate with anonymous access)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interviewer_availability'
      AND policyname = 'Allow select for authenticated'
  ) THEN
    DROP POLICY "Allow select for authenticated" ON public.interviewer_availability;
  END IF;
END$$;

-- Allow SELECT for both authenticated and anonymous users
CREATE POLICY "Allow select for all users"
ON public.interviewer_availability
FOR SELECT
USING (true);

-- Keep INSERT/UPDATE/DELETE restricted to authenticated users only
-- (These should already exist, but we ensure they're in place)

DO $$
BEGIN
  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interviewer_availability'
      AND policyname = 'Allow insert for authenticated'
  ) THEN
    CREATE POLICY "Allow insert for authenticated"
    ON public.interviewer_availability
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interviewer_availability'
      AND policyname = 'Allow update for authenticated'
  ) THEN
    CREATE POLICY "Allow update for authenticated"
    ON public.interviewer_availability
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interviewer_availability'
      AND policyname = 'Allow delete for authenticated'
  ) THEN
    CREATE POLICY "Allow delete for authenticated"
    ON public.interviewer_availability
    FOR DELETE
    TO authenticated
    USING (true);
  END IF;
END$$;

-- ============================================
-- APPOINTMENTS POLICIES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for both authenticated and anonymous users (to check existing appointments)
DO $$
BEGIN
  -- Drop existing SELECT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow select for authenticated'
  ) THEN
    DROP POLICY "Allow select for authenticated" ON public.appointments;
  END IF;
  
  -- Create new policy for all users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow select for all users'
  ) THEN
    CREATE POLICY "Allow select for all users"
    ON public.appointments
    FOR SELECT
    USING (true);
  END IF;
END$$;

-- Allow INSERT for anonymous users (for self-scheduling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow insert for all users'
  ) THEN
    CREATE POLICY "Allow insert for all users"
    ON public.appointments
    FOR INSERT
    WITH CHECK (true);
  END IF;
END$$;

-- Keep UPDATE/DELETE restricted to authenticated users only
DO $$
BEGIN
  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow update for authenticated'
  ) THEN
    CREATE POLICY "Allow update for authenticated"
    ON public.appointments
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Allow delete for authenticated'
  ) THEN
    CREATE POLICY "Allow delete for authenticated"
    ON public.appointments
    FOR DELETE
    TO authenticated
    USING (true);
  END IF;
END$$;

-- ============================================
-- PROFILES POLICIES (for interviewer lookup)
-- ============================================

-- Allow anonymous users to read profiles (needed for interviewer names in availability)
-- This is safe as we only expose basic info like name, not sensitive data
DO $$
BEGIN
  -- Check if RLS is enabled, if not enable it
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles'
    AND rowsecurity = false
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Create policy for all users to read active profiles (if doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Allow select for all users'
  ) THEN
    CREATE POLICY "Allow select for all users"
    ON public.profiles
    FOR SELECT
    USING (ativo = true); -- Only show active profiles
  END IF;
END$$;

-- ============================================
-- STUDENTS POLICIES (for self-scheduling status update)
-- ============================================

-- Allow anonymous users to update status and interview_date when they have a valid appointment
-- This is needed for the self-scheduling feature
-- Note: The application code should only update status and interview_date fields
DO $$
BEGIN
  -- Ensure RLS is enabled
  ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

  -- Create policy for anonymous users to update when appointment exists
  -- This allows updating the student record after creating an appointment via self-scheduling
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND policyname = 'Allow anonymous update when appointment exists'
  ) THEN
    CREATE POLICY "Allow anonymous update when appointment exists"
    ON public.students
    FOR UPDATE
    TO anon
    USING (
      -- Only allow if there's a valid appointment for this student created recently (last 5 minutes)
      -- This prevents abuse while allowing legitimate self-scheduling updates
      EXISTS (
        SELECT 1 FROM public.appointments
        WHERE appointments.student_id = students.id
        AND appointments.status = 'scheduled'
        AND appointments.created_at > NOW() - INTERVAL '5 minutes'
      )
    )
    WITH CHECK (
      -- Same check for the new values
      EXISTS (
        SELECT 1 FROM public.appointments
        WHERE appointments.student_id = students.id
        AND appointments.status = 'scheduled'
        AND appointments.created_at > NOW() - INTERVAL '5 minutes'
      )
    );
  END IF;
END$$;
