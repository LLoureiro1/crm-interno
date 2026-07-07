import { ENGAGEMENT_WEIGHTS } from '@/utils/engagementScore';

export type StudentsListFiltersState = {
  searchTerm: string;
  statusFilter: string[];
  unitFilter: string[];
  segmentFilter: string[];
  seriesFilter: string[];
  examDateFilter: string[];
  academicYearFilter: string[];
  sortField: 'created_at';
  sortOrder: 'desc' | 'asc';
  contactAttemptsFilter: 'all' | '0' | '1' | '2' | '3' | '4' | 'ge_5';
  engagementTierFilter: string[];
  emptyEmailFilter: 'all' | 'com_email' | 'sem_email';
  attendedByFilter: string[];
  currentPage: number;
};

const STORAGE_KEY = 'students_list_filters';

export const STATUS_LABELS: Record<string, string> = {
  nao_confirmado: 'Não Confirmado',
  confirmado: 'Confirmado',
  cadastro_invalido: 'Cadastro Inválido',
  matriculado: 'Matriculado',
  desistente: 'Desistente',
  nenhum_agendamento: 'Nenhum Agendamento',
  atendimento_agendado: 'Atendimento Agendado',
  faltou_ao_atendimento: 'Faltou ao Atendimento',
  atendimento_recentemente: 'Atendimento Recentemente',
  atendimento_ha_mais_de_uma_semana: 'Atendimento há mais de uma semana',
  ausente: 'Ausente',
};

export const EXAM_DATE_LABELS: Record<string, string> = {
  sem_data: 'Sem Data',
  hoje: 'Hoje',
  futuras: 'Futuras',
  passadas: 'Passadas',
};

export const CONTACT_ATTEMPTS_LABELS: Record<string, string> = {
  '0': '0 contatos',
  '1': '1 contato',
  '2': '2 contatos',
  '3': '3 contatos',
  '4': '4 contatos',
  ge_5: '≥ 5 contatos',
};

export const ENGAGEMENT_TIER_LABELS: Record<string, string> = {
  alto: `Alto (≥${ENGAGEMENT_WEIGHTS.tierHigh})`,
  medio: `Médio (${ENGAGEMENT_WEIGHTS.tierMedium}–${ENGAGEMENT_WEIGHTS.tierHigh - 1})`,
  baixo: `Baixo (1–${ENGAGEMENT_WEIGHTS.tierMedium - 1})`,
};

export const EMAIL_FILTER_LABELS: Record<string, string> = {
  com_email: 'Com e-mail',
  sem_email: 'Sem e-mail',
};

export function getCurrentAcademicYear(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (currentMonth >= 8) return String(currentYear + 1);
  return String(currentYear);
}

export function getDefaultAcademicYearFilter(availableYears: string[]): string[] {
  const current = getCurrentAcademicYear();
  if (availableYears.includes(current)) return [current];
  if (availableYears.length > 0) return [availableYears[0]];
  return [];
}

export function isDefaultSort(sortField: string, sortOrder: string): boolean {
  return sortField === 'created_at' && sortOrder === 'desc';
}

export function hasNonDefaultFilters(
  state: StudentsListFiltersState,
  defaultAcademicYear: string[]
): boolean {
  if (state.searchTerm.trim()) return true;
  if (state.statusFilter.length > 0) return true;
  if (state.unitFilter.length > 0) return true;
  if (state.segmentFilter.length > 0) return true;
  if (state.seriesFilter.length > 0) return true;
  if (state.examDateFilter.length > 0) return true;
  if (
    JSON.stringify([...state.academicYearFilter].sort()) !==
    JSON.stringify([...defaultAcademicYear].sort())
  ) {
    return true;
  }
  if (state.contactAttemptsFilter !== 'all') return true;
  if (state.engagementTierFilter.length > 0) return true;
  if (state.emptyEmailFilter !== 'all') return true;
  if (state.attendedByFilter.length > 0) return true;
  if (!isDefaultSort(state.sortField, state.sortOrder)) return true;
  return false;
}

export function hasAdvancedFiltersActive(state: StudentsListFiltersState): boolean {
  return (
    state.segmentFilter.length > 0 ||
    state.seriesFilter.length > 0 ||
    state.examDateFilter.length > 0 ||
    state.contactAttemptsFilter !== 'all' ||
    state.engagementTierFilter.length > 0 ||
    state.emptyEmailFilter !== 'all' ||
    state.attendedByFilter.length > 0 ||
    !isDefaultSort(state.sortField, state.sortOrder)
  );
}

export type FilterChip = {
  id: string;
  label: string;
  type:
    | 'search'
    | 'status'
    | 'unit'
    | 'segment'
    | 'series'
    | 'examDate'
    | 'academicYear'
    | 'contactAttempts'
    | 'engagement'
    | 'email'
    | 'attendedBy'
    | 'sort';
  value?: string;
};

export function buildFilterChips(
  state: StudentsListFiltersState,
  ctx: {
    defaultAcademicYear: string[];
    unitNames: Record<string, string>;
    seriesNames: Record<string, string>;
    segmentNames: Record<string, string>;
    attendantNames: Record<string, string>;
    examDateLabels: Record<string, string>;
  }
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (state.searchTerm.trim()) {
    chips.push({
      id: 'search',
      type: 'search',
      label: `Busca: ${state.searchTerm.trim()}`,
    });
  }

  const defaultYears = [...ctx.defaultAcademicYear].sort().join(',');
  const selectedYears = [...state.academicYearFilter].sort().join(',');
  if (selectedYears && selectedYears !== defaultYears) {
    state.academicYearFilter.forEach((year) => {
      chips.push({
        id: `academicYear:${year}`,
        type: 'academicYear',
        value: year,
        label: `Ano: ${year}`,
      });
    });
  }

  state.statusFilter.forEach((status) => {
    chips.push({
      id: `status:${status}`,
      type: 'status',
      value: status,
      label: `Status: ${STATUS_LABELS[status] || status}`,
    });
  });

  state.unitFilter.forEach((unitId) => {
    chips.push({
      id: `unit:${unitId}`,
      type: 'unit',
      value: unitId,
      label: `Unidade: ${ctx.unitNames[unitId] || unitId}`,
    });
  });

  state.segmentFilter.forEach((segment) => {
    chips.push({
      id: `segment:${segment}`,
      type: 'segment',
      value: segment,
      label: `Segmento: ${ctx.segmentNames[segment] || segment}`,
    });
  });

  state.seriesFilter.forEach((seriesId) => {
    chips.push({
      id: `series:${seriesId}`,
      type: 'series',
      value: seriesId,
      label: `Série: ${ctx.seriesNames[seriesId] || seriesId}`,
    });
  });

  state.examDateFilter.forEach((examKey) => {
    chips.push({
      id: `examDate:${examKey}`,
      type: 'examDate',
      value: examKey,
      label: `Prova: ${ctx.examDateLabels[examKey] || EXAM_DATE_LABELS[examKey] || examKey}`,
    });
  });

  if (state.contactAttemptsFilter !== 'all') {
    chips.push({
      id: `contactAttempts:${state.contactAttemptsFilter}`,
      type: 'contactAttempts',
      value: state.contactAttemptsFilter,
      label: `Contatos: ${CONTACT_ATTEMPTS_LABELS[state.contactAttemptsFilter]}`,
    });
  }

  state.engagementTierFilter.forEach((tier) => {
    chips.push({
      id: `engagement:${tier}`,
      type: 'engagement',
      value: tier,
      label: `Nota: ${ENGAGEMENT_TIER_LABELS[tier] || tier}`,
    });
  });

  if (state.emptyEmailFilter !== 'all') {
    chips.push({
      id: `email:${state.emptyEmailFilter}`,
      type: 'email',
      value: state.emptyEmailFilter,
      label: EMAIL_FILTER_LABELS[state.emptyEmailFilter],
    });
  }

  state.attendedByFilter.forEach((attendantId) => {
    chips.push({
      id: `attendedBy:${attendantId}`,
      type: 'attendedBy',
      value: attendantId,
      label: `Atendido por: ${ctx.attendantNames[attendantId] || attendantId}`,
    });
  });

  if (!isDefaultSort(state.sortField, state.sortOrder)) {
    chips.push({
      id: 'sort',
      type: 'sort',
      label:
        state.sortOrder === 'asc' ? 'Inscrições mais antigas' : 'Inscrições mais recentes',
    });
  }

  return chips;
}

export function loadStudentsListFilters(): StudentsListFiltersState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudentsListFiltersState;
  } catch {
    return null;
  }
}

export function saveStudentsListFilters(state: StudentsListFiltersState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage indisponível ou quota excedida
  }
}

export function clearStudentsListFilters(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
