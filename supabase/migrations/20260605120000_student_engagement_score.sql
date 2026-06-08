-- Score de engajamento: colunas, motor heurístico, triggers, cron, snapshots ML

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS engagement_score smallint,
  ADD COLUMN IF NOT EXISTS engagement_score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS engagement_score_at timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_score_source text NOT NULL DEFAULT 'heuristic',
  ADD COLUMN IF NOT EXISTS engagement_model_version text NOT NULL DEFAULT 'heuristic_v1';

CREATE INDEX IF NOT EXISTS idx_students_unit_engagement_score
  ON public.students (unit_id, engagement_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_students_engagement_score
  ON public.students (engagement_score DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- Motor heurístico
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_student_engagement_score(p_student_id uuid)
RETURNS TABLE(score smallint, breakdown jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.student_status;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_class_has_exam boolean;
  v_final_grade numeric;
  v_auto_agendamento int := 0;
  v_email int := 0;
  v_comparecimento int := 0;
  v_recencia int := 0;
  v_funil int := 0;
  v_outreach int := 0;
  v_total int;
  v_last_touch timestamptz;
  v_days_since_touch int;
  v_has_early_schedule boolean := false;
  v_has_reagendamento boolean := false;
  v_email_open_count int := 0;
  v_emails_sent int := 0;
  v_has_realizado boolean := false;
  v_has_faltou_appt boolean := false;
  v_succeeded_contacts int := 0;
  v_breakdown jsonb;
BEGIN
  SELECT s.status, s.created_at, s.updated_at, c.has_exam, s.final_grade
  INTO v_status, v_created_at, v_updated_at, v_class_has_exam, v_final_grade
  FROM public.students s
  JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = p_student_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_status IN ('cadastro_invalido', 'processo_anos_anteriores') THEN
    RETURN QUERY SELECT NULL::smallint, NULL::jsonb;
    RETURN;
  END IF;

  IF v_status = 'matriculado' THEN
    v_breakdown := jsonb_build_object('total', 100);
    RETURN QUERY SELECT 100::smallint, v_breakdown;
    RETURN;
  END IF;

  IF v_status = 'desistente' THEN
    v_breakdown := jsonb_build_object('total', 0);
    RETURN QUERY SELECT 0::smallint, v_breakdown;
    RETURN;
  END IF;

  -- Auto-agendamento (somente turma sem prova) — máx. +12
  IF NOT v_class_has_exam THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.student_interactions si
      WHERE si.student_id = p_student_id
        AND si.interaction_type = 'agendamento_entrevista'
        AND si.created_at <= v_created_at + interval '24 hours'
    ) INTO v_has_early_schedule;

    IF v_has_early_schedule THEN
      v_auto_agendamento := 9;
    ELSIF v_status = 'nenhum_agendamento'
      AND now() >= v_created_at + interval '48 hours'
    THEN
      v_auto_agendamento := -7;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.student_interactions si
      WHERE si.student_id = p_student_id
        AND si.interaction_type = 'reagendamento'
    ) INTO v_has_reagendamento;

    IF v_has_reagendamento THEN
      v_auto_agendamento := v_auto_agendamento + 3;
    END IF;
  END IF;

  -- E-mail — máx. +8
  SELECT
    COALESCE(MAX(eq.opened_count), 0),
    COALESCE(COUNT(*) FILTER (WHERE eq.status = 'sent'), 0)
  INTO v_email_open_count, v_emails_sent
  FROM public.email_queue eq
  WHERE eq.student_id = p_student_id;

  IF v_email_open_count > 0 THEN
    v_email := 6;
    IF v_email_open_count >= 2 THEN
      v_email := v_email + 2;
    END IF;
  ELSIF v_emails_sent >= 1 THEN
    v_email := -5;
  END IF;

  -- Comparecimento — máx. +11
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.student_id = p_student_id AND a.status = 'realizado'
  ) INTO v_has_realizado;

  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.student_id = p_student_id AND a.status = 'faltou'
  ) INTO v_has_faltou_appt;

  IF v_status = 'ausente' THEN
    v_comparecimento := -8;
  ELSIF v_status = 'faltou_ao_atendimento' OR v_has_faltou_appt THEN
    v_comparecimento := -7;
  ELSIF v_has_realizado THEN
    v_comparecimento := 7;
  END IF;

  IF v_final_grade IS NOT NULL THEN
    v_comparecimento := v_comparecimento + 4;
  END IF;

  -- Recência — máx. +8
  SELECT GREATEST(
    v_updated_at,
    COALESCE((SELECT MAX(si.created_at) FROM public.student_interactions si WHERE si.student_id = p_student_id), v_created_at),
    COALESCE((SELECT MAX(ca.attempted_at) FROM public.contact_attempts ca WHERE ca.student_id = p_student_id), v_created_at),
    COALESCE((SELECT MAX(eq.opened_at) FROM public.email_queue eq WHERE eq.student_id = p_student_id AND eq.opened_at IS NOT NULL), v_created_at)
  ) INTO v_last_touch;

  v_days_since_touch := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - v_last_touch)) / 86400)::int);

  IF v_days_since_touch <= 3 THEN
    v_recencia := 8;
  ELSIF v_days_since_touch <= 7 THEN
    v_recencia := 4;
  ELSIF v_days_since_touch <= 14 THEN
    v_recencia := 1;
  ELSE
    v_recencia := -6;
  END IF;

  -- Funil — máx. +6
  v_funil := CASE v_status
    WHEN 'atendimento_recentemente' THEN 6
    WHEN 'atendimento_agendado' THEN 4
    WHEN 'confirmado' THEN 2
    WHEN 'nao_confirmado' THEN 1
    WHEN 'atendimento_ha_mais_de_uma_semana' THEN 3
    ELSE 0
  END;

  -- Contato outbound — máx. +5
  SELECT COUNT(*)::int
  INTO v_succeeded_contacts
  FROM public.contact_attempts ca
  WHERE ca.student_id = p_student_id AND ca.succeeded = true;

  v_outreach := LEAST(v_succeeded_contacts * 2, 5);

  v_total := 50 + v_auto_agendamento + v_email + v_comparecimento + v_recencia + v_funil + v_outreach;
  v_total := GREATEST(0, LEAST(100, v_total));

  v_breakdown := jsonb_build_object(
    'base', 50,
    'auto_agendamento', v_auto_agendamento,
    'email', v_email,
    'comparecimento', v_comparecimento,
    'recencia', v_recencia,
    'funil', v_funil,
    'contato_outbound', v_outreach,
    'days_since_touch', v_days_since_touch,
    'total', v_total
  );

  RETURN QUERY SELECT v_total::smallint, v_breakdown;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_student_engagement_score(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score smallint;
  v_breakdown jsonb;
BEGIN
  SELECT cs.score, cs.breakdown
  INTO v_score, v_breakdown
  FROM public.compute_student_engagement_score(p_student_id) cs;

  UPDATE public.students
  SET
    engagement_score = v_score,
    engagement_score_breakdown = v_breakdown,
    engagement_score_at = now(),
    engagement_score_source = 'heuristic',
    engagement_model_version = 'heuristic_v1'
  WHERE id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_engagement_scores(
  p_unit_id uuid DEFAULT NULL,
  p_limit int DEFAULT 500,
  p_academic_year text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_count int := 0;
BEGIN
  FOR v_student_id IN
    SELECT s.id
    FROM public.students s
    WHERE (p_unit_id IS NULL OR s.unit_id = p_unit_id)
      AND (p_academic_year IS NULL OR s.ano_letivo::text = p_academic_year)
      AND s.status NOT IN ('cadastro_invalido', 'processo_anos_anteriores')
    ORDER BY s.engagement_score_at NULLS FIRST, s.updated_at DESC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    PERFORM public.refresh_student_engagement_score(v_student_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Snapshots para ML futuro
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.engagement_feature_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  status_at_snapshot public.student_status NOT NULL,
  days_since_signup int NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  heuristic_score smallint,
  heuristic_breakdown jsonb,
  outcome_label text,
  outcome_at timestamptz,
  snapshot_kind text NOT NULL DEFAULT 'periodic'
);

CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_student
  ON public.engagement_feature_snapshots (student_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_outcome
  ON public.engagement_feature_snapshots (outcome_label, snapshot_at DESC)
  WHERE outcome_label IS NOT NULL;

ALTER TABLE public.engagement_feature_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'engagement_feature_snapshots'
      AND policyname = 'Authenticated read engagement snapshots'
  ) THEN
    CREATE POLICY "Authenticated read engagement snapshots"
      ON public.engagement_feature_snapshots
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.engagement_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  coefficients jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.engagement_model_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'engagement_model_versions'
      AND policyname = 'Authenticated read engagement models'
  ) THEN
    CREATE POLICY "Authenticated read engagement models"
      ON public.engagement_model_versions
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.capture_engagement_feature_snapshot(
  p_student_id uuid,
  p_kind text DEFAULT 'periodic',
  p_outcome_label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_status public.student_status;
  v_created_at timestamptz;
  v_days int;
  v_score smallint;
  v_breakdown jsonb;
  v_features jsonb;
  v_snapshot_id uuid;
BEGIN
  PERFORM public.refresh_student_engagement_score(p_student_id);

  SELECT s.unit_id, s.status, s.created_at, s.engagement_score, s.engagement_score_breakdown
  INTO v_unit_id, v_status, v_created_at, v_score, v_breakdown
  FROM public.students s
  WHERE s.id = p_student_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_status IN ('cadastro_invalido', 'processo_anos_anteriores') THEN
    RETURN NULL;
  END IF;

  v_days := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - v_created_at)) / 86400)::int);

  v_features := COALESCE(v_breakdown, '{}'::jsonb) || jsonb_build_object(
    'status', v_status::text,
    'days_since_signup', v_days,
    'has_exam', (
      SELECT c.has_exam FROM public.classes c
      JOIN public.students st ON st.class_id = c.id
      WHERE st.id = p_student_id
    ),
    'interactions_count', (SELECT COUNT(*) FROM public.student_interactions si WHERE si.student_id = p_student_id),
    'contact_attempts_count', (SELECT COUNT(*) FROM public.contact_attempts ca WHERE ca.student_id = p_student_id),
    'succeeded_contacts_count', (SELECT COUNT(*) FROM public.contact_attempts ca WHERE ca.student_id = p_student_id AND ca.succeeded = true),
    'emails_sent_count', (SELECT COUNT(*) FROM public.email_queue eq WHERE eq.student_id = p_student_id AND eq.status = 'sent'),
    'email_open_count', (SELECT COALESCE(SUM(eq.opened_count), 0) FROM public.email_queue eq WHERE eq.student_id = p_student_id),
    'appointments_realizado_count', (SELECT COUNT(*) FROM public.appointments a WHERE a.student_id = p_student_id AND a.status = 'realizado'),
    'has_final_grade', (SELECT s.final_grade IS NOT NULL FROM public.students s WHERE s.id = p_student_id)
  );

  INSERT INTO public.engagement_feature_snapshots (
    student_id,
    unit_id,
    status_at_snapshot,
    days_since_signup,
    features,
    heuristic_score,
    heuristic_breakdown,
    outcome_label,
    outcome_at,
    snapshot_kind
  ) VALUES (
    p_student_id,
    v_unit_id,
    v_status,
    v_days,
    v_features,
    v_score,
    v_breakdown,
    p_outcome_label,
    CASE WHEN p_outcome_label IS NOT NULL THEN now() ELSE NULL END,
    p_kind
  )
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_engagement_snapshots_batch(p_limit int DEFAULT 500)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_count int := 0;
BEGIN
  FOR v_student_id IN
    SELECT s.id
    FROM public.students s
    WHERE s.status NOT IN (
      'cadastro_invalido', 'processo_anos_anteriores', 'matriculado', 'desistente'
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.engagement_feature_snapshots efs
        WHERE efs.student_id = s.id
          AND efs.snapshot_at >= now() - interval '7 days'
      )
    ORDER BY s.updated_at DESC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    PERFORM public.capture_engagement_feature_snapshot(v_student_id, 'periodic', NULL);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.export_engagement_training_dataset(
  p_unit_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  snapshot_id uuid,
  student_id uuid,
  unit_id uuid,
  snapshot_at timestamptz,
  status_at_snapshot text,
  days_since_signup int,
  heuristic_score smallint,
  outcome_label text,
  outcome_at timestamptz,
  label_numeric int,
  features jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    efs.id,
    efs.student_id,
    efs.unit_id,
    efs.snapshot_at,
    efs.status_at_snapshot::text,
    efs.days_since_signup,
    efs.heuristic_score,
    efs.outcome_label,
    efs.outcome_at,
    CASE
      WHEN efs.outcome_label = 'matriculado' THEN 1
      WHEN efs.outcome_label = 'desistente' THEN 0
      ELSE NULL
    END,
    efs.features
  FROM public.engagement_feature_snapshots efs
  WHERE efs.outcome_label IS NOT NULL
    AND (p_unit_id IS NULL OR efs.unit_id = p_unit_id)
    AND (p_from IS NULL OR efs.snapshot_at >= p_from)
    AND (p_to IS NULL OR efs.snapshot_at <= p_to)
  ORDER BY efs.snapshot_at DESC;
$$;

-- ---------------------------------------------------------------------------
-- Triggers de recálculo
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_refresh_engagement_from_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_student_engagement_score(NEW.student_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_engagement_from_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_student_engagement_score(NEW.student_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_engagement_from_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.opened_at IS DISTINCT FROM OLD.opened_at
       OR NEW.opened_count IS DISTINCT FROM OLD.opened_count
       OR NEW.status IS DISTINCT FROM OLD.status
     )
  THEN
    PERFORM public.refresh_student_engagement_score(NEW.student_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_engagement_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    PERFORM public.refresh_student_engagement_score(NEW.student_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_engagement_from_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.final_grade IS DISTINCT FROM OLD.final_grade THEN
    PERFORM public.refresh_student_engagement_score(NEW.id);

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('matriculado', 'desistente')
    THEN
      PERFORM public.capture_engagement_feature_snapshot(
        NEW.id,
        'terminal',
        NEW.status::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_engagement_student_interactions ON public.student_interactions;
CREATE TRIGGER trg_engagement_student_interactions
  AFTER INSERT ON public.student_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_engagement_from_interaction();

DROP TRIGGER IF EXISTS trg_engagement_contact_attempts ON public.contact_attempts;
CREATE TRIGGER trg_engagement_contact_attempts
  AFTER INSERT ON public.contact_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_engagement_from_contact();

DROP TRIGGER IF EXISTS trg_engagement_email_queue ON public.email_queue;
CREATE TRIGGER trg_engagement_email_queue
  AFTER INSERT OR UPDATE OF opened_at, opened_count, status ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_engagement_from_email();

DROP TRIGGER IF EXISTS trg_engagement_appointments ON public.appointments;
CREATE TRIGGER trg_engagement_appointments
  AFTER INSERT OR UPDATE OF status, attended ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_engagement_from_appointment();

DROP TRIGGER IF EXISTS trg_engagement_students_status ON public.students;
CREATE TRIGGER trg_engagement_students_status
  AFTER UPDATE OF status, final_grade ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_engagement_from_student();

-- ---------------------------------------------------------------------------
-- Cron jobs
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-engagement-scores-daily') THEN
    PERFORM cron.unschedule('refresh-engagement-scores-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-engagement-scores-daily',
  '30 3 * * *',
  $$ SELECT public.refresh_engagement_scores(NULL, 2000); $$
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'engagement-feature-snapshots-weekly') THEN
    PERFORM cron.unschedule('engagement-feature-snapshots-weekly');
  END IF;
END $$;

SELECT cron.schedule(
  'engagement-feature-snapshots-weekly',
  '0 4 * * 0',
  $$ SELECT public.capture_engagement_snapshots_batch(1000); $$
);

-- Backfill inicial: ano letivo corrente (regra ago+: ano+1)
DO $$
DECLARE
  v_year text;
BEGIN
  IF EXTRACT(MONTH FROM now()) >= 8 THEN
    v_year := (EXTRACT(YEAR FROM now()) + 1)::int::text;
  ELSE
    v_year := EXTRACT(YEAR FROM now())::int::text;
  END IF;

  PERFORM public.refresh_engagement_scores(NULL, 50000, v_year);
END $$;
