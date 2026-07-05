-- Próximo exame: compara data+hora no fuso de Brasília; impede inscrição em prova passada

CREATE OR REPLACE FUNCTION public.get_next_exam_date_for_unit(p_unit_id uuid)
RETURNS TABLE(id uuid, exam_date date)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ed.id, ed.exam_date
  FROM public.exam_dates ed
  WHERE ed.unit_id = p_unit_id
    AND (ed.exam_date + ed.exam_time) > timezone('America/Sao_Paulo', now())::timestamp
  ORDER BY ed.exam_date ASC, ed.exam_time ASC
  LIMIT 1;
$$;

-- Remove triggers que sobrescreviam exam_date_id no INSERT (causa raiz)
DROP TRIGGER IF EXISTS trg_auto_assign_exam_date_after ON public.students;
DROP TRIGGER IF EXISTS trg_auto_assign_exam_date ON public.students;
DROP FUNCTION IF EXISTS public.auto_assign_exam_date_to_student();

CREATE OR REPLACE FUNCTION public.set_student_exam_date_from_fk()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_exam_at timestamp;
  v_now_brt timestamp;
BEGIN
  v_now_brt := timezone('America/Sao_Paulo', now())::timestamp;

  IF NEW.exam_date_id IS NOT NULL THEN
    SELECT ed.exam_date, (ed.exam_date + ed.exam_time)
    INTO NEW.exam_date, v_exam_at
    FROM public.exam_dates ed
    WHERE ed.id = NEW.exam_date_id;

    IF v_exam_at IS NOT NULL AND v_exam_at <= v_now_brt THEN
      SELECT n.id, n.exam_date
      INTO NEW.exam_date_id, NEW.exam_date
      FROM public.get_next_exam_date_for_unit(NEW.unit_id) n;
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = NEW.class_id AND c.has_exam = true
  ) THEN
    SELECT n.id, n.exam_date
    INTO NEW.exam_date_id, NEW.exam_date
    FROM public.get_next_exam_date_for_unit(NEW.unit_id) n;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_student(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_student_id uuid;
  v_additional_phones jsonb;
  v_phone text;
  v_ip_raw text;
  v_ip inet;
  v_recent_count integer;
  v_responsible_cpf text;
  v_has_exam boolean := false;
  v_exam_date_id uuid;
  v_exam_date date;
BEGIN
  IF COALESCE(trim(p_payload->>'website'), '') <> '' THEN
    RETURN jsonb_build_object(
      'success', true,
      'id', gen_random_uuid(),
      'registration_token', gen_random_uuid()
    );
  END IF;

  IF p_payload IS NULL
    OR p_payload->>'student_name' IS NULL
    OR p_payload->>'class_id' IS NULL
    OR p_payload->>'unit_id' IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados obrigatórios ausentes');
  END IF;

  v_responsible_cpf := regexp_replace(COALESCE(p_payload->>'responsible_cpf', ''), '\D', '', 'g');

  IF v_responsible_cpf <> '' AND NOT public.validate_cpf(v_responsible_cpf) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CPF do responsável inválido');
  END IF;

  BEGIN
    v_ip_raw := COALESCE(
      nullif(trim(split_part(
        COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1
      )), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'x-real-ip'), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'cf-connecting-ip'), '')
    );

    IF v_ip_raw IS NOT NULL THEN
      v_ip := v_ip_raw::inet;

      SELECT count(*)::integer INTO v_recent_count
      FROM public.registration_rate_limits
      WHERE client_ip = v_ip
        AND created_at > now() - interval '1 hour';

      IF v_recent_count >= 15 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Muitas inscrições em pouco tempo. Tente novamente mais tarde.'
        );
      END IF;

      INSERT INTO public.registration_rate_limits (client_ip) VALUES (v_ip);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  SELECT c.has_exam INTO v_has_exam
  FROM public.classes c
  WHERE c.id = (p_payload->>'class_id')::uuid;

  IF v_has_exam THEN
    SELECT n.id, n.exam_date
    INTO v_exam_date_id, v_exam_date
    FROM public.get_next_exam_date_for_unit((p_payload->>'unit_id')::uuid) n;
  END IF;

  v_additional_phones := COALESCE(p_payload->'additional_phones', '[]'::jsonb);

  INSERT INTO public.students (
    student_name,
    responsible_name,
    responsible_cpf,
    birth_date,
    phone,
    email,
    city,
    neighborhood,
    origin_school,
    class_id,
    unit_id,
    registration_source_id,
    tracking_code,
    status,
    exam_date_id,
    exam_date,
    registration_token
  ) VALUES (
    p_payload->>'student_name',
    p_payload->>'responsible_name',
    NULLIF(v_responsible_cpf, ''),
    CASE
      WHEN COALESCE(p_payload->>'birth_date', '') = '' THEN NULL
      ELSE (p_payload->>'birth_date')::date
    END,
    p_payload->>'phone',
    p_payload->>'email',
    NULLIF(p_payload->>'city', ''),
    p_payload->>'neighborhood',
    COALESCE(p_payload->>'origin_school', ''),
    (p_payload->>'class_id')::uuid,
    (p_payload->>'unit_id')::uuid,
    CASE
      WHEN COALESCE(p_payload->>'registration_source_id', '') = '' THEN NULL
      ELSE (p_payload->>'registration_source_id')::uuid
    END,
    NULLIF(p_payload->>'tracking_code', ''),
    COALESCE(p_payload->>'status', 'nenhum_agendamento')::public.student_status,
    v_exam_date_id,
    v_exam_date,
    v_token
  )
  RETURNING id INTO v_student_id;

  IF jsonb_typeof(v_additional_phones) = 'array' AND jsonb_array_length(v_additional_phones) > 0 THEN
    FOR v_phone IN
      SELECT trim(value)
      FROM jsonb_array_elements_text(v_additional_phones) AS value
    LOOP
      IF length(regexp_replace(v_phone, '\D', '', 'g')) IN (10, 11) THEN
        INSERT INTO public.student_phones (student_id, phone_number)
        VALUES (v_student_id, v_phone);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_student_id,
    'registration_token', v_token::text,
    'exam_date_id', v_exam_date_id,
    'exam_date', v_exam_date
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_student(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_student(jsonb) TO anon, authenticated;
