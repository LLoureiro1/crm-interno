import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ALL_REPORT_STATUS_ORDER } from '@/utils/classStatusAggregation';
import { cn } from '@/lib/utils';

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

const STATUS_SHORT_LABELS: Record<string, string> = {
  nao_confirmado: 'Não Confirmado',
  confirmado: 'Confirmado',
  ausente: 'Ausente',
  nenhum_agendamento: 'Nenhum Agendamento',
  atendimento_agendado: 'Agendado',
  faltou_ao_atendimento: 'Faltou',
  atendimento_recentemente: 'Recente',
  atendimento_ha_mais_de_uma_semana: '+1 Semana',
  desistente: 'Desistente',
  matriculado: 'Matriculado',
};

type CountVariant = 'default' | 'desist' | 'matric' | 'meta';

function CountCell({ value, variant = 'default' }: { value: number; variant?: CountVariant }) {
  if (variant === 'meta') {
    return (
      <span className="font-bold tabular-nums text-primary">{value || 0}</span>
    );
  }

  if (value === 0) {
    return <span className="tabular-nums text-gray-300">0</span>;
  }

  const base = 'font-bold tabular-nums';
  if (variant === 'desist') return <span className={cn(base, 'text-red-600')}>{value}</span>;
  if (variant === 'matric') return <span className={cn(base, 'text-green-600')}>{value}</span>;
  return <span className={cn(base, 'text-gray-900')}>{value}</span>;
}

function statusHeaderClass(status: string) {
  if (status === 'desistente') return 'text-red-500';
  if (status === 'matriculado') return 'text-green-600';
  return 'text-gray-500';
}

function statusCellVariant(status: string): CountVariant {
  if (status === 'desistente') return 'desist';
  if (status === 'matriculado') return 'matric';
  return 'default';
}

export function UnitsStatusOverviewTable({ rows, totals, loading }: UnitsStatusOverviewTableProps) {
  if (loading && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Carregando unidades...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma unidade encontrada.</p>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200 hover:bg-transparent">
            <TableHead className="min-w-[140px] px-3 py-2 text-left text-xs font-medium text-gray-500">
              Unidade
            </TableHead>
            <TableHead className="min-w-[52px] px-2 py-2 text-center text-xs font-medium text-gray-500">
              Inscritos
            </TableHead>
            {ALL_REPORT_STATUS_ORDER.map((status) => (
              <TableHead
                key={status}
                className={cn(
                  'min-w-[52px] px-2 py-2 text-center text-xs font-medium',
                  statusHeaderClass(status)
                )}
              >
                {STATUS_SHORT_LABELS[status] ?? status}
              </TableHead>
            ))}
            <TableHead className="min-w-[44px] px-2 py-2 text-center text-xs font-medium text-primary">
              Meta
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.unitId}
              className={cn('border-b border-gray-100 hover:bg-transparent', loading && 'opacity-60')}
            >
              <TableCell className="px-3 py-2 text-left text-sm font-medium leading-snug text-gray-900">
                {row.unitName}
              </TableCell>
              <TableCell className="px-2 py-2 text-center text-sm">
                <CountCell value={row.inscritos} />
              </TableCell>
              {ALL_REPORT_STATUS_ORDER.map((status) => (
                <TableCell key={status} className="px-2 py-2 text-center text-sm">
                  <CountCell
                    value={row.statusCounts[status] ?? 0}
                    variant={statusCellVariant(status)}
                  />
                </TableCell>
              ))}
              <TableCell className="px-2 py-2 text-center text-sm">
                <CountCell value={row.goal} variant="meta" />
              </TableCell>
            </TableRow>
          ))}
          {totals && (
            <TableRow className="border-t-2 border-primary/20 hover:bg-transparent">
              <TableCell className="px-3 py-2 text-left text-sm font-bold text-primary">Total</TableCell>
              <TableCell className="px-2 py-2 text-center text-sm">
                <CountCell value={totals.inscritos} />
              </TableCell>
              {ALL_REPORT_STATUS_ORDER.map((status) => (
                <TableCell key={status} className="px-2 py-2 text-center text-sm">
                  <CountCell
                    value={totals.statusCounts[status] ?? 0}
                    variant={statusCellVariant(status)}
                  />
                </TableCell>
              ))}
              <TableCell className="px-2 py-2 text-center text-sm">
                <CountCell value={totals.goal} variant="meta" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
