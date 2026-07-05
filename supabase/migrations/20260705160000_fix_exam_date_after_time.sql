-- Ignora exames do dia já encerrados e respeita exam_date_id enviado pela inscrição

CREATE OR REPLACE FUNCTION public.auto_assign_exam_date_to_student()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_now_brt timestamp;
  v_today_brt date;
  v_time_brt time;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = NEW.class_id AND c.has_exam = true
  ) AND NEW.exam_date_id IS NULL THEN
    v_now_brt := timezone('America/Sao_Paulo', now());
    v_today_brt := v_now_brt::date;
    v_time_brt := v_now_brt::time;

    SELECT ed.id INTO NEW.exam_date_id
    FROM public.exam_dates ed
    WHERE ed.unit_id = NEW.unit_id
      AND (
        ed.exam_date > v_today_brt
        OR (ed.exam_date = v_today_brt AND ed.exam_time > v_time_brt)
      )
    ORDER BY ed.exam_date ASC, ed.exam_time ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;
