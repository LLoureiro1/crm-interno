-- Acelera listagem/filtro de escolas por ano letivo
CREATE INDEX IF NOT EXISTS idx_students_ano_letivo_created_at
  ON public.students (ano_letivo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_students_unit_id_ano_letivo
  ON public.students (unit_id, ano_letivo);
