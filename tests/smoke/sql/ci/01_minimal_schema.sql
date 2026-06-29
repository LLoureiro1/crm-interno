-- Bootstrap SOMENTE para CI/local (Postgres vazio do supabase db start).
-- NÃO executar em produção — lá as tabelas já existem via migrations reais.
-- Recria public mínimo do zero para as funções dos smoke tests rodarem isoladas.

CREATE TYPE public.student_status AS ENUM (
  'nao_confirmado',
  'confirmado',
  'cadastro_invalido',
  'nenhum_agendamento',
  'atendimento_agendado',
  'atendimento_recentemente',
  'atendimento_ha_mais_de_uma_semana',
  'faltou_ao_atendimento',
  'desistente',
  'matriculado',
  'ausente',
  'processo_anos_anteriores'
);

CREATE TYPE public.email_trigger_type AS ENUM (
  'student_registered',
  'appointment_scheduled',
  'appointment_scheduled_staff',
  'appointment_reminder_same_day',
  'exam_reminder_1_day_before',
  'attended_over_a_week_ago',
  'missed_appointment_reschedule',
  'invite_to_schedule',
  'exam_reminder_same_day',
  'post_attendance_followup',
  'post_attendance_3_days',
  'matricula_concluida',
  'staff_new_lead_no_appointment',
  'staff_missed_appointment_no_reschedule',
  'staff_proposal_no_response',
  'staff_contact_list_assigned'
);

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Unidade teste',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Série teste',
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Turma teste',
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  monthly_fee numeric NOT NULL DEFAULT 0,
  has_exam boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL DEFAULT 'Aluno teste',
  responsible_name text NOT NULL DEFAULT 'Responsável teste',
  phone text NOT NULL DEFAULT '11999999999',
  email text NOT NULL DEFAULT 'teste@exemplo.com',
  city text NOT NULL DEFAULT 'São Paulo',
  neighborhood text NOT NULL DEFAULT 'Centro',
  origin_school text NOT NULL DEFAULT 'Escola teste',
  birth_date date NOT NULL DEFAULT '2010-01-01',
  class_id uuid NOT NULL REFERENCES public.classes(id),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  status public.student_status NOT NULL DEFAULT 'nenhum_agendamento',
  final_grade numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabelas referenciadas por compute_student_engagement_score em cenários com aluno existente
CREATE TABLE public.student_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  appointment_date date NOT NULL DEFAULT CURRENT_DATE,
  appointment_time time NOT NULL DEFAULT '10:00',
  status text NOT NULL DEFAULT 'scheduled',
  attended boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  related_status public.student_status NOT NULL DEFAULT 'nenhum_agendamento',
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.email_queue_status AS ENUM (
  'pending',
  'sending',
  'sent',
  'failed',
  'cancelled'
);

CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  trigger_type public.email_trigger_type NOT NULL DEFAULT 'student_registered',
  status public.email_queue_status NOT NULL DEFAULT 'pending',
  opened_count integer NOT NULL DEFAULT 0,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.refresh_engagement_scores(
  p_unit_id uuid DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NULL;
END;
$$;
