import {
  STUDENT_STATUS_COLORS,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUS_FUNNEL_EXCLUDED,
  STUDENT_STATUS_FUNNEL_ORDER,
} from '@/utils/studentStatus';

/** Status exibidos e contabilizados no gráfico por turma. */
export const ALL_REPORT_STATUS_ORDER = [...STUDENT_STATUS_FUNNEL_ORDER] as const;

const EXCLUDED_STATUSES = new Set<string>(STUDENT_STATUS_FUNNEL_EXCLUDED);

export function isExcludedFromClassChart(status: string): boolean {
  return EXCLUDED_STATUSES.has(status);
}

export type ClassSeriesInfo = {
  id: string;
  name: string;
  level: string;
  ordenar: number;
};

export type ReportClassRow = {
  id: string;
  name: string;
  unit_id: string;
  series_id: string;
  series: ClassSeriesInfo;
};

export type ReportStudentRow = {
  class_id: string;
  status: string;
};

export type ClassStatusSegment = {
  status: string;
  label: string;
  count: number;
  color: string;
};

export type ClassStatusRow = {
  classId: string;
  className: string;
  unitId: string;
  unitName: string;
  seriesId: string;
  seriesName: string;
  seriesOrder: number;
  statusCounts: Record<string, number>;
  segments: ClassStatusSegment[];
  total: number;
};

export type ClassStatusUnitGroup = {
  unitId: string;
  unitName: string;
  rows: ClassStatusRow[];
  unitTotal: number;
};

function buildSegments(
  statusCounts: Record<string, number>,
  statusFilter: string
): ClassStatusSegment[] {
  const statuses =
    statusFilter === 'all'
      ? ALL_REPORT_STATUS_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0)
      : [statusFilter];

  return statuses.map((status) => ({
    status,
    label: STUDENT_STATUS_LABELS[status] ?? status,
    count: statusCounts[status] ?? 0,
    color: STUDENT_STATUS_COLORS[status] ?? '#1437cc',
  }));
}

function rowTotal(statusCounts: Record<string, number>, statusFilter: string): number {
  if (statusFilter === 'all') {
    return ALL_REPORT_STATUS_ORDER.reduce(
      (sum, status) => sum + (statusCounts[status] ?? 0),
      0
    );
  }
  return statusCounts[statusFilter] ?? 0;
}

export function formatClassRowLabel(row: ClassStatusRow, peersInUnit: ClassStatusRow[]): string {
  const sameSeries = peersInUnit.filter((r) => r.seriesId === row.seriesId);
  if (sameSeries.length > 1) {
    return `${row.seriesName} — ${row.className}`;
  }
  return row.seriesName;
}

export function buildClassStatusGroups(
  students: ReportStudentRow[],
  classes: ReportClassRow[],
  unitNames: Record<string, string>,
  statusFilter: string = 'all'
): ClassStatusUnitGroup[] {
  const countsByClass: Record<string, Record<string, number>> = {};

  for (const student of students) {
    if (isExcludedFromClassChart(student.status)) {
      continue;
    }
    if (statusFilter !== 'all' && student.status !== statusFilter) {
      continue;
    }
    if (!countsByClass[student.class_id]) {
      countsByClass[student.class_id] = {};
    }
    const bucket = countsByClass[student.class_id];
    bucket[student.status] = (bucket[student.status] ?? 0) + 1;
  }

  const rows: ClassStatusRow[] = classes.map((cls) => {
    const statusCounts = countsByClass[cls.id] ?? {};
    const segments = buildSegments(statusCounts, statusFilter);
    const total = rowTotal(statusCounts, statusFilter);

    return {
      classId: cls.id,
      className: cls.name,
      unitId: cls.unit_id,
      unitName: unitNames[cls.unit_id] ?? 'Unidade',
      seriesId: cls.series_id,
      seriesName: cls.series.name,
      seriesOrder: cls.series.ordenar,
      statusCounts,
      segments,
      total,
    };
  });

  const byUnit = new Map<string, ClassStatusRow[]>();
  for (const row of rows) {
    const list = byUnit.get(row.unitId) ?? [];
    list.push(row);
    byUnit.set(row.unitId, list);
  }

  return Array.from(byUnit.entries())
    .map(([, unitRows]) => {
      const sortedRows = [...unitRows].sort((a, b) => {
        if (a.seriesOrder !== b.seriesOrder) return a.seriesOrder - b.seriesOrder;
        return a.className.localeCompare(b.className, 'pt-BR');
      });
      const first = sortedRows[0];
      return {
        unitId: first.unitId,
        unitName: first.unitName,
        rows: sortedRows,
        unitTotal: sortedRows.reduce((sum, r) => sum + r.total, 0),
      };
    })
    .sort((a, b) => a.unitName.localeCompare(b.unitName, 'pt-BR'));
}

export function getActiveStatusLegend(
  rows: ClassStatusRow[],
  statusFilter: string
): ClassStatusSegment[] {
  if (statusFilter !== 'all') {
    return [
      {
        status: statusFilter,
        label: STUDENT_STATUS_LABELS[statusFilter] ?? statusFilter,
        count: 0,
        color: STUDENT_STATUS_COLORS[statusFilter] ?? '#1437cc',
      },
    ];
  }

  const used = new Set<string>();
  for (const row of rows) {
    for (const seg of row.segments) {
      used.add(seg.status);
    }
  }
  return ALL_REPORT_STATUS_ORDER.filter((status) => used.has(status)).map((status) => ({
    status,
    label: STUDENT_STATUS_LABELS[status] ?? status,
    count: 0,
    color: STUDENT_STATUS_COLORS[status] ?? '#1437cc',
  }));
}
