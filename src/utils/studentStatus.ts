/** Ordem linear para barras (igual à grade «Alunos por Status»). */
export const STUDENT_STATUS_FUNNEL_ORDER = [
  'nenhum_agendamento',
  'confirmado',
  'atendimento_agendado',
  'faltou_ao_atendimento',
  'atendimento_recentemente',
  'atendimento_ha_mais_de_uma_semana',
  'desistente',
  'matriculado',
] as const;

/** Etapas do funil com ramificações laterais para status marginais. */
export type FunnelStage =
  | { type: 'single'; status: string }
  | { type: 'split'; main: string; marginal: string };

export const STUDENT_STATUS_FUNNEL_STAGES: FunnelStage[] = [
  { type: 'single', status: 'nenhum_agendamento' },
  { type: 'single', status: 'confirmado' },
  { type: 'single', status: 'atendimento_agendado' },
  { type: 'single', status: 'faltou_ao_atendimento' },
  { type: 'single', status: 'atendimento_recentemente' },
  { type: 'single', status: 'atendimento_ha_mais_de_uma_semana' },
  { type: 'split', main: 'matriculado', marginal: 'desistente' },
];

/** Status excluídos do funil de conversão. */
export const STUDENT_STATUS_FUNNEL_EXCLUDED = [
  'cadastro_invalido',
] as const;

export const STUDENT_STATUS_LABELS: Record<string, string> = {
  nenhum_agendamento: 'Sem Contato',
  confirmado: 'Contato Realizado',
  atendimento_agendado: 'Reunião Agendada',
  faltou_ao_atendimento: 'Faltou a Reunião',
  atendimento_recentemente: 'Reunião Recente',
  atendimento_ha_mais_de_uma_semana: 'Reunião há mais de uma semana',
  cadastro_invalido: 'Escola Descartada',
  desistente: 'Desistente',
  matriculado: 'Fechado',
};

export const STUDENT_STATUS_COLORS: Record<string, string> = {
  nenhum_agendamento: '#cbd5e1',
  confirmado: '#64748b',
  atendimento_agendado: '#64748b',
  faltou_ao_atendimento: '#A78BFA',
  atendimento_recentemente: '#1437cc',
  atendimento_ha_mais_de_uma_semana: '#f97316',
  desistente: '#ef4444',
  matriculado: '#22c55e',
  cadastro_invalido: '#000000',
};

export type FunnelDataPoint = {
  status: string;
  label: string;
  count: number;
  fill: string;
};

export function toFunnelDataPoint(
  status: string,
  statusCounts: Record<string, number>,
  labels: Record<string, string> = STUDENT_STATUS_LABELS
): FunnelDataPoint {
  return {
    status,
    label: labels[status] ?? status,
    count: statusCounts[status] ?? 0,
    fill: STUDENT_STATUS_COLORS[status] ?? '#1437cc',
  };
}

export function buildFunnelData(
  statusCounts: Record<string, number>,
  labels: Record<string, string> = STUDENT_STATUS_LABELS
): FunnelDataPoint[] {
  return STUDENT_STATUS_FUNNEL_ORDER.map((status) =>
    toFunnelDataPoint(status, statusCounts, labels)
  );
}

export type ResolvedFunnelStage =
  | { type: 'single'; item: FunnelDataPoint; rowTotal: number }
  | {
      type: 'split';
      main: FunnelDataPoint;
      marginal: FunnelDataPoint;
      rowTotal: number;
    };

export function buildFunnelStages(
  statusCounts: Record<string, number>,
  labels: Record<string, string> = STUDENT_STATUS_LABELS
): ResolvedFunnelStage[] {
  return STUDENT_STATUS_FUNNEL_STAGES.map((stage) => {
    if (stage.type === 'single') {
      const item = toFunnelDataPoint(stage.status, statusCounts, labels);
      return { type: 'single', item, rowTotal: item.count };
    }
    const main = toFunnelDataPoint(stage.main, statusCounts, labels);
    const marginal = toFunnelDataPoint(stage.marginal, statusCounts, labels);
    return {
      type: 'split',
      main,
      marginal,
      rowTotal: main.count + marginal.count,
    };
  });
}
