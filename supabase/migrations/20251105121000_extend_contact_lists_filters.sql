-- Add academic_years and exam_date_filters to contact_lists to support new creation filters
alter table public.contact_lists
  add column if not exists academic_years text[] null,
  add column if not exists exam_date_filters text[] null;

comment on column public.contact_lists.academic_years is 'Lista de anos letivos aplicados à lista (ex.: 2025, 2026)';
comment on column public.contact_lists.exam_date_filters is 'Filtros de data de prova: valores especiais (sem_data, hoje, futuras, passadas) ou date_YYYY-MM-DD';

-- NOTE: Caso haja função de avaliação de pertença (ex.: student_matches_list),
-- ela deve ser atualizada para considerar academic_years e exam_date_filters.
-- Por ora, adicionamos apenas as colunas para permitir persistência dos novos filtros de criação.