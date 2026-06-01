-- Enum novo em migration separada (commit antes de usar o valor).
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'appointment_scheduled_staff';
