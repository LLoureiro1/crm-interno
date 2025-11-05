-- Create enum for contact reasons
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_reason') THEN
    CREATE TYPE contact_reason AS ENUM (
      'agendamento',
      'reagendamento',
      'confirmacao_prova',
      'convidar_ausentes',
      'followup_pos_atendimento'
    );
  END IF;
END $$;

-- Add column to contact_attempts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contact_attempts'
      AND column_name = 'reason'
  ) THEN
    ALTER TABLE public.contact_attempts
      ADD COLUMN reason contact_reason;
  END IF;
END $$;

-- Optional index to filter by reason
CREATE INDEX IF NOT EXISTS idx_contact_attempts_reason ON public.contact_attempts(reason);