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
  if (data.length === 0) {
    return <p className="text-gray-500">Nenhum dado no período selecionado.</p>;
  }

  return (
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
          <Legend
            formatter={(value) => (value === 'inscritos' ? 'Inscritos' : 'Matriculados')}
          />
          <Line
            type="monotone"
            dataKey="inscritos"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="matriculados"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
