/** Ordem linear para barras (igual à grade «Alunos por Status»). */
export const STUDENT_STATUS_FUNNEL_ORDER = [
  'nao_confirmado',
  'confirmado',
  'ausente',
  'nenhum_agendamento',
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
  { type: 'single', status: 'nao_confirmado' },
  { type: 'single', status: 'confirmado' },
  { type: 'split', main: 'nenhum_agendamento', marginal: 'ausente' },
  { type: 'single', status: 'atendimento_agendado' },
  { type: 'single', status: 'faltou_ao_atendimento' },
  { type: 'single', status: 'atendimento_recentemente' },
  { type: 'single', status: 'atendimento_ha_mais_de_uma_semana' },
  { type: 'split', main: 'matriculado', marginal: 'desistente' },
];

/** Status excluídos do funil de conversão. */
export const STUDENT_STATUS_FUNNEL_EXCLUDED = [
  'cadastro_invalido',
  'processo_anos_anteriores',
] as const;

export const STUDENT_STATUS_LABELS: Record<string, string> = {
  nao_confirmado: 'Lead Frio',
  confirmado: 'Lead Quente',
  cadastro_invalido: 'Sem Perfil / Inválido',
  nenhum_agendamento: 'Sem Contato',
  atendimento_agendado: 'Reunião Agendada',
  atendimento_recentemente: 'Proposta Apresentada',
  atendimento_ha_mais_de_uma_semana: 'Aguardando Retorno',
  faltou_ao_atendimento: 'Reunião Desmarcada',
  ausente: 'Sem Resposta',
  desistente: 'Negociação Perdida',
  matriculado: 'Parceria Fechada',
  processo_anos_anteriores: 'Contatos Anteriores',
};

export const STUDENT_STATUS_COLORS: Record<string, string> = {
  nao_confirmado: '#94a3b8',
  confirmado: '#64748b',
  ausente: '#F87171',
  nenhum_agendamento: '#cbd5e1',
  atendimento_agendado: '#64748b',
  faltou_ao_atendimento: '#A78BFA',
  atendimento_recentemente: '#1437cc',
  atendimento_ha_mais_de_uma_semana: '#f97316',
  desistente: '#ef4444',
  matriculado: '#22c55e',
  cadastro_invalido: '#000000',
  processo_anos_anteriores: '#999999',
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
