import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  buildFunnelData,
  buildFunnelStages,
  STUDENT_STATUS_FUNNEL_EXCLUDED,
  type FunnelDataPoint,
} from '@/utils/studentStatus';
import { getSegmentLabel } from '@/utils/educationLevel';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Unit = Tables<'units'>;
type Series = Tables<'series'>;

type ChartView = 'funnel' | 'bars' | 'horizontal';

type StatusFunnelChartProps = {
  statusCounts: Record<string, number>;
  statusLabels: Record<string, string>;
  selectedUnit: string;
  selectedSegment: string;
  selectedSeries: string;
  onUnitChange: (value: string) => void;
  onSegmentChange: (value: string) => void;
  onSeriesChange: (value: string) => void;
  visibleUnits: Unit[];
  availableSegments: string[];
  filteredSeriesOptions: Series[];
  onStatusClick?: (status: string, label: string) => void;
};

const chartViewLabels: Record<ChartView, string> = {
  funnel: 'Funil',
  bars: 'Barras verticais',
  horizontal: 'Barras horizontais',
};

const chartWrapperClass = 'aspect-auto h-[min(420px,60vh)] min-h-[320px] w-full';

function FunnelBar({
  item,
  total,
  maxCount,
  variant,
  onStatusClick,
}: {
  item: FunnelDataPoint;
  total: number;
  maxCount: number;
  variant: 'single' | 'main' | 'marginal';
  onStatusClick?: (status: string, label: string) => void;
}) {
  const pctOfTotal = total > 0 ? Math.round((item.count / total) * 100) : 0;
  const isMarginal = variant === 'marginal';
  const widthPct = Math.min(
    Math.max(maxCount > 0 ? (item.count / maxCount) * 100 : 0, isMarginal ? 20 : 28),
    isMarginal ? 40 : 100
  );
  const lightFill = item.fill === '#cbd5e1' || item.fill === '#94a3b8';

  return (
    <button
      type="button"
      onClick={() => onStatusClick?.(item.status, item.label)}
      style={{ width: isMarginal ? '100%' : `${widthPct}%` }}
      className={cn(
        'block text-left transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1437cc] focus-visible:ring-offset-2',
        variant === 'single' && 'mx-auto',
        item.count === 0 && 'opacity-50'
      )}
      title={`${item.label}: ${item.count}`}
    >
      <div
        className={cn(
          'rounded-md px-3 py-2 text-center shadow-sm',
          isMarginal && 'border-2 border-dashed bg-white'
        )}
        style={{
          backgroundColor: isMarginal ? '#fff' : item.fill,
          borderColor: isMarginal ? item.fill : undefined,
          color: isMarginal || lightFill ? '#334155' : '#fff',
        }}
      >
        <p className="text-xs font-semibold leading-snug sm:text-sm">{item.label}</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums">{item.count}</p>
        <p className="text-[10px] opacity-80">{pctOfTotal}% do total</p>
      </div>
    </button>
  );
}

function ClassicFunnelView({
  stages,
  total,
  onStatusClick,
}: {
  stages: ReturnType<typeof buildFunnelStages>;
  total: number;
  onStatusClick?: (status: string, label: string) => void;
}) {
  const maxCount = Math.max(
    ...stages.flatMap((s) =>
      s.type === 'single' ? [s.item.count] : [s.main.count, s.marginal.count]
    ),
    1
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-1.5 py-2">
      <p className="mb-3 text-center text-xs text-slate-500">
        Largura proporcional à quantidade
      </p>
      {stages.map((stage, index) => (
        <div key={index} className="w-full">
          {stage.type === 'single' ? (
            <FunnelBar
              item={stage.item}
              total={total}
              maxCount={maxCount}
              variant="single"
              onStatusClick={onStatusClick}
            />
          ) : (
            <div className="flex w-full items-end justify-center gap-2 px-1 sm:gap-4 sm:px-4">
              <div className="min-w-0 flex-[3]">
                <FunnelBar
                  item={stage.main}
                  total={total}
                  maxCount={maxCount}
                  variant="main"
                  onStatusClick={onStatusClick}
                />
              </div>
              <div className="w-px shrink-0 self-stretch bg-slate-300/80" aria-hidden />
              <div className="min-w-[5.5rem] max-w-[9.5rem] shrink-0 flex-[1.15]">
                <FunnelBar
                  item={stage.marginal}
                  total={total}
                  maxCount={maxCount}
                  variant="marginal"
                  onStatusClick={onStatusClick}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function handleBarClick(
  data: unknown,
  onStatusClick?: (status: string, label: string) => void
) {
  const payload = (data as { payload?: FunnelDataPoint })?.payload;
  if (payload?.status) {
    onStatusClick?.(payload.status, payload.label);
  }
}

export function StatusFunnelChart({
  statusCounts,
  statusLabels,
  selectedUnit,
  selectedSegment,
  selectedSeries,
  onUnitChange,
  onSegmentChange,
  onSeriesChange,
  visibleUnits,
  availableSegments,
  filteredSeriesOptions,
  onStatusClick,
}: StatusFunnelChartProps) {
  const [chartView, setChartView] = useState<ChartView>('horizontal');

  const funnelStages = useMemo(
    () => buildFunnelStages(statusCounts, statusLabels),
    [statusCounts, statusLabels]
  );

  const funnelData = useMemo(
    () => buildFunnelData(statusCounts, statusLabels),
    [statusCounts, statusLabels]
  );

  const chartBarData = useMemo(
    () => funnelData.map((d) => ({ ...d, contagem: d.count })),
    [funnelData]
  );

  const totalInFunnel = useMemo(
    () =>
      Object.entries(statusCounts)
        .filter(
          ([status]) =>
            !(STUDENT_STATUS_FUNNEL_EXCLUDED as readonly string[]).includes(status)
        )
        .reduce((sum, [, count]) => sum + count, 0),
    [statusCounts]
  );

  const hasAnyCount = totalInFunnel > 0;

  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {
      contagem: { label: 'Contagem', color: '#1437cc' },
    };
    funnelData.forEach((d) => {
      config[d.status] = { label: d.label, color: d.fill };
    });
    return config;
  }, [funnelData]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedUnit !== 'all') {
      const unit = visibleUnits.find((u) => u.id === selectedUnit);
      parts.push(unit?.name ?? 'Unidade');
    } else {
      parts.push('Todas as unidades');
    }
    if (selectedSegment !== 'all') {
      parts.push(getSegmentLabel(selectedSegment));
    }
    if (selectedSeries !== 'all') {
      const serie = filteredSeriesOptions.find((s) => s.id === selectedSeries);
      parts.push(serie?.name ?? 'Série');
    }
    return parts.join(' · ');
  }, [selectedUnit, selectedSegment, selectedSeries, visibleUnits, filteredSeriesOptions]);

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Funil por status</CardTitle>
            <CardDescription>
              Jornada dos candidatos do ano letivo vigente · {filterSummary}
            </CardDescription>
          </div>
          <Select value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Tipo de gráfico" />
            </SelectTrigger>
            <SelectContent side="bottom">
              {(Object.keys(chartViewLabels) as ChartView[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {chartViewLabels[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={selectedUnit} onValueChange={onUnitChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="all">Todas as unidades</SelectItem>
              {visibleUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSegment} onValueChange={onSegmentChange}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {availableSegments.map((level) => (
                <SelectItem key={level} value={level}>
                  {getSegmentLabel(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSeries} onValueChange={onSeriesChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Série" />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="all">Todas as séries</SelectItem>
              {filteredSeriesOptions.map((serie) => (
                <SelectItem key={serie.id} value={serie.id}>
                  {serie.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {!hasAnyCount ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum aluno encontrado com os filtros selecionados.
          </p>
        ) : chartView === 'funnel' ? (
          <ClassicFunnelView
            stages={funnelStages}
            total={totalInFunnel}
            onStatusClick={onStatusClick}
          />
        ) : chartView === 'bars' ? (
          <ChartContainer config={chartConfig} className={chartWrapperClass}>
            <BarChart data={chartBarData} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={72}
                tick={{ fontSize: 10 }}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="contagem"
                radius={[4, 4, 0, 0]}
                cursor={onStatusClick ? 'pointer' : 'default'}
                onClick={(data) => handleBarClick(data, onStatusClick)}
              >
                {chartBarData.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[min(480px,70vh)] min-h-[360px] w-full"
          >
            <BarChart
              data={chartBarData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={140}
                tick={{ fontSize: 11 }}
              />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="contagem"
                radius={[0, 4, 4, 0]}
                cursor={onStatusClick ? 'pointer' : 'default'}
                onClick={(data) => handleBarClick(data, onStatusClick)}
              >
                {chartBarData.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}

        {hasAnyCount && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Total no funil: <strong>{totalInFunnel}</strong> alunos · Clique em uma etapa para ver a lista
          </p>
        )}
      </CardContent>
    </Card>
  );
}
