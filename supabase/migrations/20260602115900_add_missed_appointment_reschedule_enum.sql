-- Deve rodar em migration separada: enum novo só pode ser usado após commit.
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'missed_appointment_reschedule';
