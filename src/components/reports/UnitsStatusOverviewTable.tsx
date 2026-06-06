import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ALL_REPORT_STATUS_ORDER } from '@/utils/classStatusAggregation';
import { STUDENT_STATUS_LABELS } from '@/utils/studentStatus';

export type UnitStatusOverviewRow = {
  unitId: string;
  unitName: string;
  statusCounts: Record<string, number>;
  total: number;
  inscritos: number;
  matriculados: number;
  goal: number;
};

type UnitsStatusOverviewTableProps = {
  rows: UnitStatusOverviewRow[];
  totals: UnitStatusOverviewRow | null;
  loading?: boolean;
};

function StatusHeaderLabel({ label }: { label: string }) {
  const words = label.split(/\s+/);
  return (
    <span className="inline-flex flex-col items-center justify-center leading-tight gap-0.5">
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>{word}</span>
      ))}
    </span>
  );
}

export function UnitsStatusOverviewTable({ rows, totals, loading }: UnitsStatusOverviewTableProps) {
  if (rows.length === 0) {
    return <p className="text-gray-500">Carregando unidades...</p>;
  }

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full table-fixed text-[11px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 w-[120px] bg-background px-1 py-1.5 text-left">
              Unidade
            </TableHead>
            <TableHead className="w-[44px] px-0.5 py-1.5 text-center align-middle">
              <StatusHeaderLabel label="Inscritos" />
            </TableHead>
            {ALL_REPORT_STATUS_ORDER.map((status) => (
              <TableHead
                key={status}
                className="w-[52px] px-0.5 py-1.5 text-center align-middle font-medium"
              >
                <StatusHeaderLabel label={STUDENT_STATUS_LABELS[status] || status} />
              </TableHead>
            ))}
            <TableHead className="w-[40px] px-0.5 py-1.5 text-center align-middle">
              <StatusHeaderLabel label="Meta" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.unitId} className={loading ? 'opacity-60' : undefined}>
              <TableCell className="sticky left-0 z-10 bg-background px-1 py-1 font-medium truncate" title={row.unitName}>
                {row.unitName}
              </TableCell>
              <TableCell className="px-0.5 py-1 text-center tabular-nums">{row.inscritos}</TableCell>
              {ALL_REPORT_STATUS_ORDER.map((status) => (
                <TableCell key={status} className="px-0.5 py-1 text-center tabular-nums">
                  {row.statusCounts[status] ?? 0}
                </TableCell>
              ))}
              <TableCell className="px-0.5 py-1 text-center text-muted-foreground tabular-nums">
                {row.goal || '—'}
              </TableCell>
            </TableRow>
          ))}
          {totals && (
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="sticky left-0 z-10 bg-muted/50 px-1 py-1">Total</TableCell>
              <TableCell className="px-0.5 py-1 text-center tabular-nums">{totals.inscritos}</TableCell>
              {ALL_REPORT_STATUS_ORDER.map((status) => (
                <TableCell key={status} className="px-0.5 py-1 text-center tabular-nums">
                  {totals.statusCounts[status] ?? 0}
                </TableCell>
              ))}
              <TableCell className="px-0.5 py-1 text-center tabular-nums">{totals.goal || '—'}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
