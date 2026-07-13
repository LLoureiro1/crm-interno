import { ENGAGEMENT_WEIGHTS } from '@/utils/engagementScore';

export type StudentCountOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'between';

export type StudentCountFilter =
  | { op: 'gt' | 'lt' | 'gte' | 'lte'; value: number }
  | { op: 'between'; value: number; valueTo: number }
  | null;

export type StudentsListFiltersState = {
  searchTerm: string;
  statusFilter: string[];
  segmentFilter: string[];
  academicYearFilter: string[];
  sortField: 'created_at' | 'total_alunos';
  sortOrder: 'desc' | 'asc';
  contactAttemptsFilter: 'all' | '0' | '1' | '2' | '3' | '4' | 'ge_5';
  engagementTierFilter: string[];
  emptyEmailFilter: 'all' | 'com_email' | 'sem_email';
  attendedByFilter: string[];
  cityFilter: string[];
  studentCountFilter: StudentCountFilter;
  currentPage: number;
};

const STORAGE_KEY = 'students_list_filters';
const CACHE_VERSION = 3; // incrementar quando o shape mudar

export const STATUS_LABELS: Record<string, string> = {
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

export const STUDENT_COUNT_OP_LABELS: Record<StudentCountOperator, string> = {
  gt: 'Mais que',
  lt: 'Menos que',
  gte: 'Maior ou igual a',
  lte: 'Menor ou igual a',
  between: 'Entre',
};

export function formatStudentCountFilterLabel(f: StudentCountFilter): string {
  if (!f) return '';
  if (f.op === 'between') return `Alunos entre ${f.value} e ${f.valueTo}`;
  return `Alunos ${STUDENT_COUNT_OP_LABELS[f.op].toLowerCase()} ${f.value}`;
}

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

export function hasNonDefaultFilters(
  state: StudentsListFiltersState,
  defaultAcademicYear: string[]
): boolean {
  if (state.searchTerm.trim()) return true;
  if (state.statusFilter.length > 0) return true;
  if (state.segmentFilter.length > 0) return true;
  if (
    JSON.stringify([...state.academicYearFilter].sort()) !==
    JSON.stringify([...defaultAcademicYear].sort())
  ) {
    return true;
  }
  if (state.contactAttemptsFilter !== 'all') return true;
  if (state.engagementTierFilter.length > 0) return true;
  if (state.emptyEmailFilter !== 'all') return true;
  if ((state.attendedByFilter?.length ?? 0) > 0) return true;
  if ((state.cityFilter?.length ?? 0) > 0) return true;
  if (state.studentCountFilter !== null) return true;
  return false;
}

export function hasAdvancedFiltersActive(state: StudentsListFiltersState): boolean {
  return (
    (state.segmentFilter?.length ?? 0) > 0 ||
    state.contactAttemptsFilter !== 'all' ||
    (state.engagementTierFilter?.length ?? 0) > 0 ||
    state.emptyEmailFilter !== 'all' ||
    (state.attendedByFilter?.length ?? 0) > 0 ||
    (state.cityFilter?.length ?? 0) > 0 ||
    state.studentCountFilter !== null
  );
}

export type FilterChip = {
  id: string;
  label: string;
  type:
    | 'search'
    | 'status'
    | 'segment'
    | 'academicYear'
    | 'contactAttempts'
    | 'engagement'
    | 'email'
    | 'attendedBy'
    | 'city'
    | 'studentCount'
    | 'sort';
  value?: string;
};

export function buildFilterChips(
  state: StudentsListFiltersState,
  ctx: {
    defaultAcademicYear: string[];
    segmentNames: Record<string, string>;
    attendantNames: Record<string, string>;
  }
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (state.searchTerm.trim()) {
    chips.push({ id: 'search', type: 'search', label: `Busca: ${state.searchTerm.trim()}` });
  }

  const defaultYears = [...ctx.defaultAcademicYear].sort().join(',');
  const selectedYears = [...state.academicYearFilter].sort().join(',');
  if (selectedYears && selectedYears !== defaultYears) {
    state.academicYearFilter.forEach((year) => {
      chips.push({ id: `academicYear:${year}`, type: 'academicYear', value: year, label: `Ano: ${year}` });
    });
  }

  state.statusFilter.forEach((status) => {
    chips.push({ id: `status:${status}`, type: 'status', value: status, label: `Status: ${STATUS_LABELS[status] || status}` });
  });

  state.segmentFilter.forEach((segment) => {
    chips.push({ id: `segment:${segment}`, type: 'segment', value: segment, label: `Segmento: ${ctx.segmentNames[segment] || segment}` });
  });

  state.cityFilter.forEach((city) => {
    chips.push({ id: `city:${city}`, type: 'city', value: city, label: `Cidade: ${city}` });
  });

  if (state.studentCountFilter !== null) {
    chips.push({
      id: 'studentCount',
      type: 'studentCount',
      label: formatStudentCountFilterLabel(state.studentCountFilter),
    });
  }

  if (state.contactAttemptsFilter !== 'all') {
    chips.push({
      id: `contactAttempts:${state.contactAttemptsFilter}`,
      type: 'contactAttempts',
      value: state.contactAttemptsFilter,
      label: `Contatos: ${CONTACT_ATTEMPTS_LABELS[state.contactAttemptsFilter]}`,
    });
  }

  state.engagementTierFilter.forEach((tier) => {
    chips.push({ id: `engagement:${tier}`, type: 'engagement', value: tier, label: `Nota: ${ENGAGEMENT_TIER_LABELS[tier] || tier}` });
  });

  if (state.emptyEmailFilter !== 'all') {
    chips.push({ id: `email:${state.emptyEmailFilter}`, type: 'email', value: state.emptyEmailFilter, label: EMAIL_FILTER_LABELS[state.emptyEmailFilter] });
  }

  state.attendedByFilter.forEach((attendantId) => {
    chips.push({ id: `attendedBy:${attendantId}`, type: 'attendedBy', value: attendantId, label: `Atendido por: ${ctx.attendantNames[attendantId] || attendantId}` });
  });

  return chips;
}

export function loadStudentsListFilters(): StudentsListFiltersState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudentsListFiltersState & { _v?: number };
    // Invalida cache de versões anteriores (schema incompatível)
    if (!parsed._v || parsed._v < CACHE_VERSION) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudentsListFilters(state: StudentsListFiltersState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _v: CACHE_VERSION }));
  } catch {
    // sessionStorage indisponível ou quota excedida
  }
}

export function clearStudentsListFilters(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
