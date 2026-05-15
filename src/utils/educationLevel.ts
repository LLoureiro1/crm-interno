import type { Tables } from '@/integrations/supabase/types';

export type EducationLevel = Tables<'series'>['level'];

export const SEGMENT_ORDER: EducationLevel[] = [
  'educacao_infantil',
  'fundamental_i',
  'fundamental_ii',
  'medio',
  'cursos_livres',
];

export const SEGMENT_LABELS: Record<EducationLevel, string> = {
  educacao_infantil: 'Educação Infantil',
  fundamental_i: 'Fundamental I',
  fundamental_ii: 'Fundamental II',
  medio: 'Ensino Médio',
  cursos_livres: 'Cursos Livres',
};

export function getSegmentLabel(level: string): string {
  return SEGMENT_LABELS[level as EducationLevel] ?? level;
}

export function sortSegments(levels: string[]): string[] {
  return [...new Set(levels)].sort(
    (a, b) =>
      SEGMENT_ORDER.indexOf(a as EducationLevel) -
      SEGMENT_ORDER.indexOf(b as EducationLevel)
  );
}

export function getSeriesIdsForSegment(
  seriesList: Tables<'series'>[],
  segment: string
): string[] {
  if (segment === 'all') return [];
  return seriesList.filter((s) => s.level === segment).map((s) => s.id);
}

export function getClassIdsForSeriesFilter(
  classes: Tables<'classes'>[],
  seriesList: Tables<'series'>[],
  selectedSeriesId: string,
  selectedSegment: string
): string[] | null {
  if (selectedSeriesId !== 'all') {
    return classes.filter((c) => c.series_id === selectedSeriesId).map((c) => c.id);
  }
  if (selectedSegment !== 'all') {
    const seriesIds = getSeriesIdsForSegment(seriesList, selectedSegment);
    return classes.filter((c) => seriesIds.includes(c.series_id)).map((c) => c.id);
  }
  return null;
}
