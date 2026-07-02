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
  currentPage: number;
};

const STORAGE_KEY = 'students_list_filters';

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
