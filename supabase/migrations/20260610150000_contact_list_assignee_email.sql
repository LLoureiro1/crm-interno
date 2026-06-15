-- Enum precisa ser commitado antes de usar em INSERT (limitação do Postgres).
ALTER TYPE public.email_trigger_type ADD VALUE IF NOT EXISTS 'staff_contact_list_assigned';
