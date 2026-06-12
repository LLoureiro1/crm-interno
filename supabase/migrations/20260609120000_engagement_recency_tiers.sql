-- Faixas de recência mais granulares (91+ dias = -12)

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
  v_class_has_exam boolean;
  v_final_grade numeric;
  v_auto_agendamento int := 0;
  v_email int := 0;
  v_comparecimento int := 0;
  v_recencia int := 0;
  v_recencia_falhas int := 0;
  v_funil int := 0;
  v_outreach int := 0;
  v_total int;
  v_raw_total int;
  v_last_successful_touch timestamptz;
  v_days_since_successful_contact int;
  v_failed_attempts_recent int := 0;
  v_has_early_schedule boolean := false;
  v_has_reagendamento boolean := false;
  v_email_open_count int := 0;
  v_emails_sent int := 0;
  v_has_realizado boolean := false;
  v_has_faltou_appt boolean := false;
  v_succeeded_contacts int := 0;
  v_breakdown jsonb;
BEGIN
  SELECT s.status, s.created_at, c.has_exam, s.final_grade
  INTO v_status, v_created_at, v_class_has_exam, v_final_grade
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

  SELECT
    COALESCE(SUM(eq.opened_count), 0),
    COALESCE(COUNT(*) FILTER (WHERE eq.status = 'sent'), 0)
  INTO v_email_open_count, v_emails_sent
  FROM public.email_queue eq
  WHERE eq.student_id = p_student_id
    AND public.is_student_facing_email(eq.trigger_type);

  IF v_email_open_count > 0 THEN
    v_email := 6;
    IF v_email_open_count >= 2 THEN
      v_email := v_email + 2;
    END IF;
  ELSIF v_emails_sent >= 1 THEN
    v_email := -5;
  END IF;

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

  SELECT GREATEST(
    COALESCE((
      SELECT MAX(ca.attempted_at)
      FROM public.contact_attempts ca
      WHERE ca.student_id = p_student_id AND ca.succeeded = true
    ), '-infinity'::timestamptz),
    COALESCE((
      SELECT MAX(eq.opened_at)
      FROM public.email_queue eq
      WHERE eq.student_id = p_student_id
        AND eq.opened_at IS NOT NULL
        AND public.is_student_facing_email(eq.trigger_type)
    ), '-infinity'::timestamptz),
    COALESCE((
      SELECT MAX(a.updated_at)
      FROM public.appointments a
      WHERE a.student_id = p_student_id AND a.status = 'realizado'
    ), '-infinity'::timestamptz),
    COALESCE((
      SELECT MAX(si.created_at)
      FROM public.student_interactions si
      WHERE si.student_id = p_student_id
        AND si.interaction_type IN ('atendimento', 'agendamento_entrevista', 'reagendamento')
    ), '-infinity'::timestamptz)
  ) INTO v_last_successful_touch;

  IF v_last_successful_touch = '-infinity'::timestamptz THEN
    v_days_since_successful_contact := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (now() - v_created_at)) / 86400)::int
    );
  ELSE
    v_days_since_successful_contact := GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (now() - v_last_successful_touch)) / 86400)::int
    );
  END IF;

  -- Recência por dias desde último contato bem-sucedido
  IF v_days_since_successful_contact <= 1 THEN
    v_recencia := 8;
  ELSIF v_days_since_successful_contact <= 3 THEN
    v_recencia := 5;
  ELSIF v_days_since_successful_contact <= 7 THEN
    v_recencia := 3;
  ELSIF v_days_since_successful_contact <= 10 THEN
    v_recencia := 1;
  ELSIF v_days_since_successful_contact <= 14 THEN
    v_recencia := -1;
  ELSIF v_days_since_successful_contact <= 21 THEN
    v_recencia := -3;
  ELSIF v_days_since_successful_contact <= 30 THEN
    v_recencia := -4;
  ELSIF v_days_since_successful_contact <= 45 THEN
    v_recencia := -6;
  ELSIF v_days_since_successful_contact <= 60 THEN
    v_recencia := -8;
  ELSIF v_days_since_successful_contact <= 90 THEN
    v_recencia := -10;
  ELSE
    v_recencia := -12;
  END IF;

  SELECT COUNT(*)::int
  INTO v_failed_attempts_recent
  FROM public.contact_attempts ca
  WHERE ca.student_id = p_student_id
    AND ca.succeeded = false
    AND ca.attempted_at >= now() - interval '90 days';

  IF v_failed_attempts_recent > 0 THEN
    v_recencia_falhas := LEAST(v_failed_attempts_recent, 4) * -1;
    v_recencia := v_recencia + v_recencia_falhas;
  END IF;

  v_funil := CASE v_status
    WHEN 'atendimento_recentemente' THEN 6
    WHEN 'atendimento_agendado' THEN 4
    WHEN 'confirmado' THEN 2
    WHEN 'nao_confirmado' THEN 1
    WHEN 'atendimento_ha_mais_de_uma_semana' THEN 3
    ELSE 0
  END;

  SELECT COUNT(*)::int
  INTO v_succeeded_contacts
  FROM public.contact_attempts ca
  WHERE ca.student_id = p_student_id AND ca.succeeded = true;

  v_outreach := LEAST(v_succeeded_contacts * 2, 5);

  v_raw_total := 50 + v_auto_agendamento + v_email + v_comparecimento + v_recencia + v_funil + v_outreach;
  v_total := GREATEST(0, LEAST(100, v_raw_total));

  v_breakdown := jsonb_build_object(
    'base', 50,
    'auto_agendamento', v_auto_agendamento,
    'email', v_email,
    'comparecimento', v_comparecimento,
    'recencia', v_recencia,
    'recencia_falhas', v_recencia_falhas,
    'funil', v_funil,
    'contato_outbound', v_outreach,
    'days_since_successful_contact', v_days_since_successful_contact,
    'failed_attempts_recent', v_failed_attempts_recent,
    'days_since_touch', v_days_since_successful_contact,
    'total', v_total
  );

  RETURN QUERY SELECT v_total::smallint, v_breakdown;
END;
$$;

SELECT public.refresh_engagement_scores(NULL, 50000);
