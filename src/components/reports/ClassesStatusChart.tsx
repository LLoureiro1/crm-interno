import { useMemo } from 'react';
import {
  buildClassStatusGroups,
  formatClassRowLabel,
  getActiveStatusLegend,
  type ClassStatusRow,
  type ClassStatusSegment,
  type ReportClassRow,
  type ReportStudentRow,
} from '@/utils/classStatusAggregation';
import { cn } from '@/lib/utils';

type ClassesStatusChartProps = {
  students: ReportStudentRow[];
  classes: ReportClassRow[];
  unitNames: Record<string, string>;
  statusFilter: string;
  onSegmentClick?: (classId: string, status: string, label: string, classLabel: string) => void;
};

function StackedBar({
  row,
  maxTotal,
  statusFilter,
  onSegmentClick,
}: {
  row: ClassStatusRow & { rowLabel?: string };
  maxTotal: number;
  statusFilter: string;
  onSegmentClick?: ClassesStatusChartProps['onSegmentClick'];
}) {
  const widthPct = maxTotal > 0 ? Math.max((row.total / maxTotal) * 100, row.total > 0 ? 4 : 0) : 0;

  return (
    <div className="relative h-7 flex-1 overflow-hidden rounded bg-slate-100">
      {row.total > 0 ? (
        <div className="flex h-full min-w-[2rem]" style={{ width: `${widthPct}%` }}>
          {row.segments.map((seg) => (
            <button
              key={seg.status}
              type="button"
              className="h-full min-w-[2px] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1437cc]"
              style={{
                width:
                  statusFilter === 'all'
                    ? `${(seg.count / row.total) * 100}%`
                    : '100%',
                backgroundColor: seg.color,
              }}
              title={`${seg.label}: ${seg.count}`}
              onClick={() =>
                onSegmentClick?.(row.classId, seg.status, seg.label, row.rowLabel ?? row.seriesName)
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ClassesStatusChart({
  students,
  classes,
  unitNames,
  statusFilter,
  onSegmentClick,
}: ClassesStatusChartProps) {
  const groups = useMemo(
    () => buildClassStatusGroups(students, classes, unitNames, statusFilter),
    [students, classes, unitNames, statusFilter]
  );

  const rowsWithLabels = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => ({
        ...row,
        rowLabel: formatClassRowLabel(row, group.rows),
      })),
    }));
  }, [groups]);

  const allRows = useMemo(() => rowsWithLabels.flatMap((g) => g.rows), [rowsWithLabels]);
  const maxTotal = useMemo(() => Math.max(...allRows.map((r) => r.total), 1), [allRows]);
  const legend = useMemo(
    () => getActiveStatusLegend(allRows, statusFilter),
    [allRows, statusFilter]
  );
  const grandTotal = useMemo(() => allRows.reduce((sum, r) => sum + r.total, 0), [allRows]);

  if (classes.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma turma encontrada com os filtros selecionados.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto pr-1">
        {rowsWithLabels.map((group) => (
          <section key={group.unitId}>
            <div className="rounded bg-[#1437cc] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
              {group.unitName}
              <span className="ml-2 font-normal opacity-90">
                ({group.unitTotal} {group.unitTotal === 1 ? 'inscrição' : 'inscrições'})
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {group.rows.map((row) => (
                <div
                  key={row.classId}
                  className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_2.25rem] items-center gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_2.5rem]"
                >
                  <span className="truncate text-slate-700" title={row.rowLabel}>
                    {row.rowLabel}
                  </span>
                  <StackedBar
                    row={row}
                    maxTotal={maxTotal}
                    statusFilter={statusFilter}
                    onSegmentClick={onSegmentClick}
                  />
                  <span
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      row.total === 0 ? 'text-slate-400' : 'text-slate-900'
                    )}
                  >
                    {row.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs text-slate-600">
          {legend.map((item: ClassStatusSegment) => (
            <span key={item.status} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </div>
      )}

      <p className="text-right text-sm text-slate-600">
        Total: <strong className="text-slate-900">{grandTotal}</strong>{' '}
        {grandTotal === 1 ? 'inscrição' : 'inscrições'}
      </p>
    </div>
  );
}
