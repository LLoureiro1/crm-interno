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

function normalizeImportText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Rótulo exibido em filtros: "Educação Infantil - Infantil I" */
export function getSeriesImportLabel(series: Pick<Tables<'series'>, 'name' | 'level'>): string {
  return `${getSegmentLabel(series.level)} - ${series.name}`;
}

/** Encontra série pelo nome da planilha (aceita nome simples ou "Segmento - Série"). */
export function findSeriesByImportLabel<T extends Pick<Tables<'series'>, 'id' | 'name' | 'level'>>(
  importLabel: string,
  allSeries: T[]
): T | undefined {
  const normalized = normalizeImportText(importLabel);
  if (!normalized) return undefined;

  const byDisplayLabel = allSeries.find(
    (series) => normalizeImportText(getSeriesImportLabel(series)) === normalized
  );
  if (byDisplayLabel) return byDisplayLabel;

  const byExactName = allSeries.find(
    (series) => normalizeImportText(series.name) === normalized
  );
  if (byExactName) return byExactName;

  if (importLabel.includes(' - ')) {
    const seriesNamePart = importLabel.split(' - ').pop()?.trim() ?? '';
    const bySuffix = allSeries.find(
      (series) => normalizeImportText(series.name) === normalizeImportText(seriesNamePart)
    );
    if (bySuffix) return bySuffix;
  }

  return allSeries.find((series) => {
    const seriesName = normalizeImportText(series.name);
    return normalized.includes(seriesName) || seriesName.includes(normalized);
  });
}

/** Encontra unidade pelo nome da planilha (comparação normalizada). */
export function findUnitByImportLabel<T extends Pick<Tables<'units'>, 'id' | 'name'>>(
  importLabel: string,
  allUnits: T[]
): T | undefined {
  const normalized = normalizeImportText(importLabel);
  if (!normalized) return undefined;

  return allUnits.find((unit) => normalizeImportText(unit.name) === normalized);
}
