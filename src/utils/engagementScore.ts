export type EngagementScoreTier = 'alto' | 'medio' | 'baixo' | 'sem';

export type EngagementScoreBreakdown = {
  base?: number;
  auto_agendamento?: number;
  email?: number;
  comparecimento?: number;
  recencia?: number;
  recencia_falhas?: number;
  funil?: number;
  contato_outbound?: number;
  days_since_touch?: number;
  days_since_successful_contact?: number;
  failed_attempts_recent?: number;
  total?: number;
};

/** Pesos heurísticos — espelham compute_student_engagement_score no Postgres (teto 100) */
export const ENGAGEMENT_WEIGHTS = {
  base: 50,
  autoAgendamento: { early24h: 9, late48hNoSchedule: -7, reagendamento: 3 },
  email: { opened: 6, openedExtra: 2, neverOpenedSent: -5 },
  comparecimento: { realizado: 7, finalGrade: 4, ausente: -8, faltou: -7 },
  recencia: { d3: 8, d7: 4, d14: 1, d30: -2, d60: -4, d90: -6, d91plus: -8, failedAttemptPenalty: -1, failedAttemptMax: 4 },
  funil: {
    atendimento_recentemente: 6,
    atendimento_agendado: 4,
    confirmado: 2,
    nao_confirmado: 1,
    atendimento_ha_mais_de_uma_semana: 3,
  },
  outreachPerSuccess: 2,
  outreachMax: 5,
  matriculadoScore: 100,
  desistenteScore: 0,
  tierHigh: 70,
  tierMedium: 40,
} as const;

const BREAKDOWN_LABELS: Record<string, string> = {
  base: 'Base inicial',
  auto_agendamento: 'Auto-agendamento',
  email: 'Engajamento com e-mail',
  comparecimento: 'Comparecimento / prova',
  recencia: 'Recência de contato',
  recencia_falhas: 'Tentativas sem sucesso (90 dias)',
  funil: 'Estágio no funil',
  contato_outbound: 'Contatos bem-sucedidos',
};

export function getScoreTier(score: number | null | undefined): EngagementScoreTier {
  if (score === null || score === undefined) return 'sem';
  if (score >= ENGAGEMENT_WEIGHTS.tierHigh) return 'alto';
  if (score >= ENGAGEMENT_WEIGHTS.tierMedium) return 'medio';
  return 'baixo';
}

export function getScoreTierLabel(tier: EngagementScoreTier): string {
  switch (tier) {
    case 'alto':
      return 'Alto';
    case 'medio':
      return 'Médio';
    case 'baixo':
      return 'Baixo';
    default:
      return 'Sem score';
  }
}

export function getScoreBadgeClassName(score: number | null | undefined): string {
  const tier = getScoreTier(score);
  switch (tier) {
    case 'alto':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'medio':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'baixo':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export function formatScoreDisplay(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return String(score);
}

export function matchesScoreTierFilter(
  score: number | null | undefined,
  tiers: string[]
): boolean {
  if (tiers.length === 0) return true;
  const tier = getScoreTier(score);
  return tiers.includes(tier);
}

export type FormattedBreakdownItem = {
  key: string;
  label: string;
  points: number;
  description?: string;
};

export function formatScoreBreakdown(
  breakdown: EngagementScoreBreakdown | Record<string, unknown> | null | undefined
): FormattedBreakdownItem[] {
  if (!breakdown || typeof breakdown !== 'object') return [];

  const skipKeys = new Set(['total', 'days_since_touch', 'days_since_successful_contact', 'failed_attempts_recent']);
  const items: FormattedBreakdownItem[] = [];

  for (const [key, raw] of Object.entries(breakdown)) {
    if (skipKeys.has(key)) continue;
    const points = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(points) || points === 0) continue;
    items.push({
      key,
      label: BREAKDOWN_LABELS[key] ?? key,
      points,
    });
  }

  const daysSince =
    typeof breakdown.days_since_successful_contact === 'number'
      ? breakdown.days_since_successful_contact
      : typeof breakdown.days_since_touch === 'number'
        ? breakdown.days_since_touch
        : undefined;

  if (typeof daysSince === 'number') {
    items.push({
      key: 'days_since_successful_contact',
      label: 'Dias desde último contato bem-sucedido',
      points: daysSince,
      description: 'Referência para recência',
    });
  }

  return items;
}

export function getRecencyWarning(daysSinceTouch: number | undefined): boolean {
  return typeof daysSinceTouch === 'number' && daysSinceTouch >= 30;
}
