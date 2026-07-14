/** Ordem linear para barras e gráficos (nomenclatura B2B do painel). */
export const STUDENT_STATUS_FUNNEL_ORDER = [
  'nenhum_agendamento',
  'confirmado',
  'portfolio_enviado',
  'atendimento_agendado',
  'faltou_ao_atendimento',
  'atendimento_recentemente',
  'atendimento_ha_mais_de_uma_semana',
  'desistente',
  'matriculado',
] as const;

/** Ordem da grade «Escolas por Status». */
export const STUDENT_STATUS_REPORT_ORDER = [
  'nenhum_agendamento',
  'confirmado',
  'portfolio_enviado',
  'atendimento_agendado',
  'faltou_ao_atendimento',
  'atendimento_recentemente',
  'atendimento_ha_mais_de_uma_semana',
  'cadastro_invalido',
  'desistente',
  'matriculado',
] as const;

/**
 * Enums legados (CRM de alunos / import) absorvidos pelos status do painel B2B.
 * Ex.: `nao_confirmado` e `ausente` contam como `nenhum_agendamento` (Sem Contato).
 */
export const STUDENT_STATUS_LEGACY_TO_REPORT: Record<string, string> = {
  nao_confirmado: 'nenhum_agendamento',
  ausente: 'nenhum_agendamento',
  processo_anos_anteriores: 'desistente',
};

/** Normaliza o status do banco para a chave usada nos cards/funil. */
export function normalizeReportStatus(status: string): string {
  return STUDENT_STATUS_LEGACY_TO_REPORT[status] ?? status;
}

/** Agrega contagens do banco nas chaves de exibição do relatório. */
export function aggregateReportStatusCounts(
  students: Array<{ status: string }>
): Record<string, number> {
  const statusCounts: Record<string, number> = {};
  for (const student of students) {
    const key = normalizeReportStatus(student.status);
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  return statusCounts;
}

/** Etapas do funil com ramificações laterais para status marginais. */
export type FunnelStage =
  | { type: 'single'; status: string }
  | { type: 'split'; main: string; marginal: string };

export const STUDENT_STATUS_FUNNEL_STAGES: FunnelStage[] = [
  { type: 'single', status: 'nenhum_agendamento' },
  { type: 'single', status: 'confirmado' },
  { type: 'single', status: 'portfolio_enviado' },
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

/** Labels do painel e do seletor (chaves = enums do banco). */
export const STUDENT_STATUS_LABELS: Record<string, string> = {
  nenhum_agendamento: 'Sem Contato',
  confirmado: 'Contato Realizado',
  atendimento_agendado: 'Reunião Agendada',
  faltou_ao_atendimento: 'Faltou a Reunião',
  atendimento_recentemente: 'Reunião Recente',
  atendimento_ha_mais_de_uma_semana: 'Reunião há mais de uma semana',
  portfolio_enviado: 'Portfólio Enviado',
  cadastro_invalido: 'Escola Descartada',
  desistente: 'Desistente',
  matriculado: 'Fechado',
  // Legados — exibidos com o nome do status agregador
  nao_confirmado: 'Sem Contato',
  ausente: 'Sem Contato',
  processo_anos_anteriores: 'Desistente',
};

/** Opções do seletor «Atualizar Status» (ordem = StudentProfile). */
export const STUDENT_STATUS_SELECT_OPTIONS = [
  'nenhum_agendamento',
  'confirmado',
  'portfolio_enviado',
  'atendimento_agendado',
  'faltou_ao_atendimento',
  'atendimento_recentemente',
  'atendimento_ha_mais_de_uma_semana',
  'cadastro_invalido',
  'desistente',
  'matriculado',
] as const;

export const STUDENT_STATUS_BADGE_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'purple' | 'warning' | 'ausente' | 'cadastro_invalido' | 'processo_anos_anteriores'
> = {
  nenhum_agendamento: 'outline',
  confirmado: 'secondary',
  atendimento_agendado: 'secondary',
  faltou_ao_atendimento: 'purple',
  atendimento_recentemente: 'default',
  atendimento_ha_mais_de_uma_semana: 'warning',
  portfolio_enviado: 'secondary',
  cadastro_invalido: 'cadastro_invalido',
  desistente: 'destructive',
  matriculado: 'success',
  nao_confirmado: 'outline',
  ausente: 'outline',
  processo_anos_anteriores: 'destructive',
};

export const STUDENT_STATUS_COLORS: Record<string, string> = {
  nenhum_agendamento: '#cbd5e1',
  confirmado: '#64748b',
  atendimento_agendado: '#64748b',
  faltou_ao_atendimento: '#A78BFA',
  atendimento_recentemente: '#1437cc',
  atendimento_ha_mais_de_uma_semana: '#f97316',
  portfolio_enviado: '#0ea5e9',
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
