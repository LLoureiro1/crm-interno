import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export type EnrollmentTimelinePoint = {
  date: string;
  label: string;
  inscritos: number;
  matriculados: number;
};

type EnrollmentTimelineChartProps = {
  data: EnrollmentTimelinePoint[];
};

export function EnrollmentTimelineChart({ data }: EnrollmentTimelineChartProps) {
  const [showInscritos, setShowInscritos] = useState(true);
  const [showMatriculados, setShowMatriculados] = useState(true);

  const handleInscritosChange = (checked: boolean) => {
    if (!checked && !showMatriculados) return;
    setShowInscritos(checked);
  };

  const handleMatriculadosChange = (checked: boolean) => {
    if (!checked && !showInscritos) return;
    setShowMatriculados(checked);
  };

  if (data.length === 0) {
    return <p className="text-gray-500">Nenhum dado no período selecionado.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-muted-foreground">Exibir:</span>
        <div className="flex items-center gap-2">
          <Checkbox
            id="timeline-inscritos"
            checked={showInscritos}
            onCheckedChange={(checked) => handleInscritosChange(checked === true)}
          />
          <Label htmlFor="timeline-inscritos" className="text-sm font-normal cursor-pointer text-blue-700">
            Inscritos
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="timeline-matriculados"
            checked={showMatriculados}
            onCheckedChange={(checked) => handleMatriculadosChange(checked === true)}
          />
          <Label htmlFor="timeline-matriculados" className="text-sm font-normal cursor-pointer text-green-700">
            Matriculados
          </Label>
        </div>
      </div>

      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
            <Tooltip
              formatter={(value: number, name: string) => [
                value,
                name === 'inscritos' ? 'Inscritos' : 'Matriculados',
              ]}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as EnrollmentTimelinePoint | undefined;
                return point?.date
                  ? new Date(point.date + 'T00:00:00').toLocaleDateString('pt-BR')
                  : '';
              }}
            />
            {(showInscritos || showMatriculados) && (
              <Legend
                formatter={(value) => (value === 'inscritos' ? 'Inscritos' : 'Matriculados')}
              />
            )}
            {showInscritos && (
              <Line
                type="monotone"
                dataKey="inscritos"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            )}
            {showMatriculados && (
              <Line
                type="monotone"
                dataKey="matriculados"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
