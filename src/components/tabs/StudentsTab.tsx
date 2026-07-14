import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Eye, ExternalLink, X, ArrowDown, ArrowUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentDialog } from '@/components/StudentDialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Tables } from '@/integrations/supabase/types';
import { formatRegistrationTimeForDisplay, getCurrentDate } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUnitAccess } from '@/hooks/useUnitAccess';
import { getSegmentLabel, sortSegments } from '@/utils/educationLevel';
import { ENGAGEMENT_WEIGHTS } from '@/utils/engagementScore';
import {
  buildFilterChips,
  getCurrentAcademicYear,
  getDefaultAcademicYearFilter,
  hasAdvancedFiltersActive,
  hasNonDefaultFilters,
  loadStudentsListFilters,
  saveStudentsListFilters,
  STATUS_LABELS,
  STUDENT_COUNT_OP_LABELS,
  type FilterChip,
  type StudentCountFilter,
  type StudentCountOperator,
} from '@/utils/studentsListFilters';
import {
  STUDENT_STATUS_BADGE_VARIANTS,
  STUDENT_STATUS_LABELS,
} from '@/utils/studentStatus';

type Student = Tables<'students'> & {
  units?: Tables<'units'> | null;
  classes?: (Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  }) | null;
  student_phones?: { phone_number: string }[];
};

export const StudentsTab = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { fullAccess, allowedUnitIds } = useUnitAccess();
  const cachedFiltersRef = useRef(loadStudentsListFilters());
  const cachedFilters = cachedFiltersRef.current;
  const skipPageResetRef = useRef(!!cachedFilters);

  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState(cachedFilters?.searchTerm ?? '');
  const [statusFilter, setStatusFilter] = useState<string[]>(cachedFilters?.statusFilter ?? []);
  const [segmentFilter, setSegmentFilter] = useState<string[]>(cachedFilters?.segmentFilter ?? []);
  const [academicYearFilter, setAcademicYearFilter] = useState<string[]>(cachedFilters?.academicYearFilter ?? []);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [availableAcademicYears, setAvailableAcademicYears] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [sortField, setSortField] = useState<'created_at' | 'total_alunos'>(cachedFilters?.sortField ?? 'created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(cachedFilters?.sortOrder ?? 'desc');
  const [contactAttemptsFilter, setContactAttemptsFilter] = useState<'all' | '0' | '1' | '2' | '3' | '4' | 'ge_5'>(
    cachedFilters?.contactAttemptsFilter ?? 'all'
  );
  const [engagementTierFilter, setEngagementTierFilter] = useState<string[]>(
    (cachedFilters?.engagementTierFilter ?? []).filter((tier) => tier !== 'sem')
  );
  const [emptyEmailFilter, setEmptyEmailFilter] = useState<'all' | 'com_email' | 'sem_email'>(
    cachedFilters?.emptyEmailFilter ?? 'all'
  );
  const [attendedByFilter, setAttendedByFilter] = useState<string[]>(
    cachedFilters?.attendedByFilter ?? []
  );
  const [cityFilter, setCityFilter] = useState<string[]>(cachedFilters?.cityFilter ?? []);
  const [studentCountFilter, setStudentCountFilter] = useState<StudentCountFilter>(
    cachedFilters?.studentCountFilter ?? null
  );
  // UI state para construção do filtro de alunos
  const [countOp, setCountOp] = useState<StudentCountOperator>('gt');
  const [countValue, setCountValue] = useState('');
  const [countValueTo, setCountValueTo] = useState('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [attendants, setAttendants] = useState<Tables<'staff_directory'>[]>([]);
  const [attendedByMap, setAttendedByMap] = useState<Record<string, string[]>>({});
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [defaultAcademicYear, setDefaultAcademicYear] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(() =>
    cachedFilters ? hasAdvancedFiltersActive(cachedFilters) : false
  );
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [yearsReady, setYearsReady] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(cachedFilters?.currentPage ?? 1);
  const itemsPerPage = 50;

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    fetchSeries();
    fetchAvailableAcademicYears();
    fetchAttendants();
    fetchAvailableCities();
  }, [fullAccess, allowedUnitIds, profile?.unit_id]);

  useEffect(() => {
    if (!yearsReady) return;
    void fetchStudentsPage();
  }, [
    yearsReady,
    currentPage,
    debouncedSearch,
    statusFilter,
    academicYearFilter,
    sortOrder,
    emptyEmailFilter,
    engagementTierFilter,
    cityFilter,
    studentCountFilter,
    fullAccess,
    allowedUnitIds,
    profile?.unit_id,
  ]);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
    if (currentPage > pages) setCurrentPage(pages);
  }, [totalCount, currentPage, itemsPerPage]);

  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, segmentFilter, academicYearFilter, sortOrder, contactAttemptsFilter, engagementTierFilter, emptyEmailFilter, attendedByFilter, cityFilter, studentCountFilter]);

  useEffect(() => {
    saveStudentsListFilters({
      searchTerm,
      statusFilter,
      segmentFilter,
      academicYearFilter,
      sortField,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      cityFilter,
      studentCountFilter,
      currentPage,
    });
  }, [
    searchTerm,
    statusFilter,
    segmentFilter,
    academicYearFilter,
    sortOrder,
    contactAttemptsFilter,
    engagementTierFilter,
    emptyEmailFilter,
    attendedByFilter,
    cityFilter,
    studentCountFilter,
    currentPage,
  ]);

  const availableSegments = useMemo(
    () => sortSegments(series.map((s) => s.level)),
    [series]
  );

  const filteredSeriesOptions = useMemo(() => {
    const list = segmentFilter.length > 0
      ? series.filter((s) => segmentFilter.includes(s.level))
      : series;
    return list.filter(Boolean).map((s) => ({
      value: s.id,
      label: s.name || 'Sem nome',
    }));
  }, [series, segmentFilter]);

  const handleSegmentFilterChange = (newSegments: string[]) => {
    setSegmentFilter(newSegments);
  };

  const applyStudentCountFilter = () => {
    const v = Number(countValue);
    if (Number.isNaN(v) || countValue.trim() === '') return;
    if (countOp === 'between') {
      const vTo = Number(countValueTo);
      if (Number.isNaN(vTo) || countValueTo.trim() === '') return;
      setStudentCountFilter({ op: 'between', value: v, valueTo: vTo });
    } else {
      setStudentCountFilter({ op: countOp, value: v });
    }
  };

  const fetchAttendants = async () => {
    let query = supabase
      .from('staff_directory')
      .select('*')
      .in('profile', ['entrevistador', 'direcao', 'admin'])
      .eq('ativo', true);

    if (!fullAccess) {
      if (allowedUnitIds.length > 0) {
        query = query.in('unit_id', allowedUnitIds);
      } else if (profile?.unit_id) {
        query = query.eq('unit_id', profile.unit_id);
      }
    }

    const { data, error } = await query.order('name');
    if (error) {
      console.error('Erro ao buscar atendentes:', error);
      return;
    }
    setAttendants((data || []).filter((p) => p?.id));
  };

  const fetchAttendedByMap = async (studentIds: string[]) => {
    if (studentIds.length === 0) {
      setAttendedByMap({});
      return;
    }

    try {
      const [interactionsRes, appointmentsRes] = await Promise.all([
        supabase
          .from('student_interactions')
          .select('student_id, user_id')
          .eq('interaction_type', 'atendimento')
          .not('user_id', 'is', null)
          .in('student_id', studentIds),
        supabase
          .from('appointments')
          .select('student_id, interviewer_id')
          .eq('attended', true)
          .not('interviewer_id', 'is', null)
          .in('student_id', studentIds),
      ]);

      if (interactionsRes.error) throw interactionsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      const map: Record<string, Set<string>> = {};
      const addAttendant = (studentId: string | null, userId: string | null) => {
        if (!studentId || !userId) return;
        if (!map[studentId]) map[studentId] = new Set();
        map[studentId].add(userId);
      };

      (interactionsRes.data || []).forEach((row) => addAttendant(row.student_id, row.user_id));
      (appointmentsRes.data || []).forEach((row) =>
        addAttendant(row.student_id, row.interviewer_id)
      );

      const serialized: Record<string, string[]> = {};
      Object.entries(map).forEach(([studentId, userIds]) => {
        serialized[studentId] = Array.from(userIds);
      });
      setAttendedByMap(serialized);
    } catch (e) {
      console.error('Erro ao buscar atendimentos:', e);
      setAttendedByMap({});
    }
  };

  const fetchAvailableCities = async () => {
    const seen = new Set<string>();
    const cities: string[] = [];
    const pageSize = 1000;
    let offset = 0;
    // Pagina até buscar todas as cidades (Supabase limita 1000/req)
    for (;;) {
      const { data, error } = await supabase
        .from('students')
        .select('city, estado')
        .not('city', 'is', null)
        .neq('city', '')
        .range(offset, offset + pageSize - 1);
      if (error || !data || data.length === 0) break;
      data.forEach((row) => {
        const label = [row.city?.trim(), row.estado?.trim()].filter(Boolean).join(' - ');
        if (label && !seen.has(label)) { seen.add(label); cities.push(label); }
      });
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    setAvailableCities(cities.sort((a, b) => a.localeCompare(b, 'pt-BR')));
  };

  const fetchStudentsPage = async () => {
    setListLoading(true);

    try {
      const years = (academicYearFilter.length > 0
        ? academicYearFilter
        : defaultAcademicYear.length > 0
          ? defaultAcademicYear
          : [getCurrentAcademicYear()]
      )
        .map(Number)
        .filter((n) => !Number.isNaN(n));

      let query = supabase
        .from('students')
        .select(`
          *,
          units:unit_id (id, name),
          classes (
            id, name,
            units (id, name),
            series (id, name, level)
          )
        `, { count: 'exact' });

      if (years.length > 0) {
        query = query.in('ano_letivo', years);
      }

      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter as any[]);
      } else {
        query = query.neq('status', 'cadastro_invalido');
      }

      if (debouncedSearch.trim()) {
        const s = `%${debouncedSearch.trim()}%`;
        query = query.or(`student_name.ilike.${s},inep_code.ilike.${s},code.ilike.${s},city.ilike.${s},estado.ilike.${s}`);
      }

      if (emptyEmailFilter === 'com_email') {
        query = query.not('email', 'is', null).neq('email', '');
      } else if (emptyEmailFilter === 'sem_email') {
        query = query.or('email.is.null,email.eq.""');
      }

      if (allowedUnitIds.length > 0) {
        query = query.in('unit_id', allowedUnitIds);
      } else if (!fullAccess && profile?.unit_id) {
        query = query.eq('unit_id', profile.unit_id);
      }

      if (cityFilter.length > 0) {
        const orClauses = cityFilter.map(c => {
          const [city, uf] = c.split(' - ');
          if (uf) return `and(city.eq."${city.trim()}",estado.eq."${uf.trim()}")`;
          return `city.eq."${c.trim()}"`;
        });
        query = query.or(orClauses.join(','));
      }

      if (studentCountFilter) {
        if (studentCountFilter.op === 'between') {
          query = query.gte('total_students_count', studentCountFilter.value).lte('total_students_count', studentCountFilter.valueTo);
        } else if (studentCountFilter.op === 'gt') {
          query = query.gt('total_students_count', studentCountFilter.value);
        } else if (studentCountFilter.op === 'lt') {
          query = query.lt('total_students_count', studentCountFilter.value);
        } else if (studentCountFilter.op === 'gte') {
          query = query.gte('total_students_count', studentCountFilter.value);
        } else if (studentCountFilter.op === 'lte') {
          query = query.lte('total_students_count', studentCountFilter.value);
        }
      }

      if (sortField === 'total_alunos') {
        query = query.order('total_students_count', { ascending: sortOrder === 'asc', nullsFirst: false });
      } else {
        query = query.order('created_at', { ascending: sortOrder === 'asc', nullsFirst: false });
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      let finalData = (data as unknown) as Student[];
      setTotalCount(count || 0);

      // Pos-filtro segment
      if (segmentFilter.length > 0) {
        finalData = finalData.filter(s => {
          if (!s.classes) return false;
          // check if any class has a series with level in segmentFilter
          const classes = Array.isArray(s.classes) ? s.classes : [s.classes];
          return classes.some(c => c.series && segmentFilter.includes(c.series.level));
        });
      }

      // Pos-filtro Atendentes
      const ids = finalData.map((s) => s.id).filter(Boolean);
      void fetchAttendedByMap(ids);
      
      if (attendedByFilter.length > 0) {
        finalData = finalData.filter((s) => {
          const attendants = attendedByMap[s.id] || [];
          return attendedByFilter.some((a) => attendants.includes(a));
        });
      }

      // Engagement tier filter (client side based on engagement_score)
      if (engagementTierFilter.length > 0) {
        finalData = finalData.filter(s => {
          const score = s.engagement_score ?? 0;
          if (engagementTierFilter.includes('alto') && score >= ENGAGEMENT_WEIGHTS.tierHigh) return true;
          if (engagementTierFilter.includes('medio') && score >= ENGAGEMENT_WEIGHTS.tierMedium && score < ENGAGEMENT_WEIGHTS.tierHigh) return true;
          if (engagementTierFilter.includes('baixo') && score < ENGAGEMENT_WEIGHTS.tierMedium) return true;
          return false;
        });
      }

      setStudents(finalData);
      setFilteredStudents(finalData);

      // Contagem de tentativas de contato
      if (ids.length === 0) { 
        setContactCounts({}); 
      } else {
        const { data: attempts, error: attemptsError } = await supabase.from('contact_attempts').select('student_id').in('student_id', ids);
        if (attemptsError) { 
          setContactCounts({}); 
        } else {
          const counts: Record<string, number> = {};
          (attempts || []).forEach((a: { student_id: string }) => { counts[a.student_id] = (counts[a.student_id] || 0) + 1; });
          setContactCounts(counts);

          // Filtro de tentativas (só pode ser feito após calcular as contagens)
          if (contactAttemptsFilter !== 'all') {
             const filteredByContact = finalData.filter(s => {
               const count = counts[s.id] || 0;
               if (contactAttemptsFilter === 'ge_5') return count >= 5;
               return count === Number(contactAttemptsFilter);
             });
             setStudents(filteredByContact);
             setFilteredStudents(filteredByContact);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao carregar escolas:', e);
      toast.error('Erro ao carregar escolas');
    } finally {
      setListLoading(false);
    }
  };



  const fetchSeries = async () => {
    const { data } = await supabase
      .from('series')
      .select('*')
      .order('ordenar', { ascending: true });
    if (data) setSeries(data);
  };

  const fetchAvailableAcademicYears = async () => {
    try {
      const current = Number(getCurrentAcademicYear());
      // Não varre a tabela (timeout em ~38k linhas): usa janela de anos locais
      const resolved = [current + 1, current, current - 1, current - 2]
        .filter((y, i, arr) => arr.indexOf(y) === i && y > 2000)
        .map(String);

      setAvailableAcademicYears(resolved);

      const defaultYear = getDefaultAcademicYearFilter(resolved);
      setDefaultAcademicYear(defaultYear);

      const cachedYears = cachedFiltersRef.current?.academicYearFilter ?? [];
      const validCached = cachedYears.filter((y) => resolved.includes(y));

      if (validCached.length > 0) {
        setAcademicYearFilter(validCached);
      } else if (defaultYear.length > 0) {
        setAcademicYearFilter(defaultYear);
      }
    } catch (e) {
      console.error('Error fetching academic years:', e);
      const fallback = [getCurrentAcademicYear()];
      setAvailableAcademicYears(fallback);
      setDefaultAcademicYear(fallback);
      setAcademicYearFilter(fallback);
    } finally {
      setYearsReady(true);
    }
  };



  const exportToExcel = async () => {
    toast.info('Exportando escolas filtradas...');
    const exportRows: Student[] = [];
    const pageSize = 100;
    const maxRows = 5000;

    const years = (academicYearFilter.length > 0
      ? academicYearFilter
      : defaultAcademicYear.length > 0
        ? defaultAcademicYear
        : [getCurrentAcademicYear()]
    )
      .map(Number)
      .filter((n) => !Number.isNaN(n));

    try {
      for (let offset = 0; offset < maxRows; offset += pageSize) {
        const { data, error } = await supabase.rpc('list_schools_page', {
          p_limit: pageSize,
          p_offset: offset,
          p_ano_letivo: years.length > 0 ? years : null,
          p_statuses: statusFilter.length > 0 ? statusFilter : null,
          p_exclude_status: statusFilter.length > 0 ? null : 'cadastro_invalido',
          p_unit_ids: null,
          p_search: debouncedSearch.trim() || null,
          p_sort_asc: sortOrder === 'asc',
          p_email_filter: emptyEmailFilter === 'all' ? null : emptyEmailFilter,
        });
        if (error) throw error;
        const payload = data as { items?: Student[]; total?: number } | null;
        const chunk = (payload?.items || []) as Student[];
        exportRows.push(...chunk);
        if (chunk.length < pageSize) break;
      }

      const exportData = exportRows.map((student) => ({
        Código: student.code,
        'Código INEP': student.inep_code || '',
        'Nome da Escola': student.student_name,
        'Contato Principal': student.responsible_name || '',
        Telefone: student.phone,
        Email: student.email || '',
        Cidade: student.city || '',
        Estado: student.estado || '',
        'Qtd Infantil': student.infantil_count || 0,
        'Qtd EF1': student.ef1_count || 0,
        'Qtd EF2': student.ef2_count || 0,
        'Qtd Ensino Médio': student.medio_count || 0,
        'Total de Alunos': student.total_students_count || 0,
        Status: STATUS_LABELS[student.status] || student.status,
        'Data de Cadastro': student.created_at
          ? new Date(student.created_at).toLocaleDateString('pt-BR')
          : '',
        'Ano Letivo': student.ano_letivo || '',
        Tag: student.tag || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Escolas');
      XLSX.writeFile(wb, `escolas_${getCurrentDate()}.xlsx`);
      toast.success(`${exportRows.length} escola(s) exportada(s)`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar escolas');
    }
  };

  const getStatusBadge = (status: string, className?: string) => {
    const label = STUDENT_STATUS_LABELS[status] || status;
    const variant = STUDENT_STATUS_BADGE_VARIANTS[status] || 'outline';
    return (
      <Badge variant={variant} className={className} title={label}>
        {label}
      </Badge>
    );
  };

  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentDialog(true);
  };

  const handleOpenStudentPage = (studentId: string) => {
    saveStudentsListFilters({
      searchTerm,
      statusFilter,
      segmentFilter,
      academicYearFilter,
      sortField,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      cityFilter,
      studentCountFilter,
      currentPage,
    });
    navigate(`/school/${studentId}`);
  };

  const handleOpenStudentPageInNewTab = (studentId: string) => {
    const url = `/school/${studentId}`;
    window.open(url, '_blank');
  };

  const handleContextMenu = (e: React.MouseEvent, studentId: string) => {
    e.preventDefault();
    handleOpenStudentPageInNewTab(studentId);
  };

  const handleCloseDialog = () => {
    setShowStudentDialog(false);
    setSelectedStudent(null);
  };

  const handleUpdateStudent = () => {
    void fetchStudentsPage();
  };

  // Paginação server-side: `students` já é a página atual
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  const currentStudents = students;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getVisiblePages = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const currentFiltersState = useMemo(
    () => ({
      searchTerm,
      statusFilter,
      segmentFilter,
      academicYearFilter,
      sortField,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      cityFilter,
      studentCountFilter,
      currentPage,
    }),
    [
      searchTerm,
      statusFilter,
      segmentFilter,
      academicYearFilter,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      cityFilter,
      studentCountFilter,
      currentPage,
    ]
  );

  const activeFilterChips = useMemo(
    () =>
      buildFilterChips(currentFiltersState, {
        defaultAcademicYear,
        segmentNames: Object.fromEntries(
          availableSegments.map((level) => [level, getSegmentLabel(level)])
        ),
        attendantNames: Object.fromEntries(attendants.map((a) => [a.id, a.name || 'Sem nome'])),
      }),
    [currentFiltersState, defaultAcademicYear, availableSegments, attendants]
  );

  const showClearFilters = hasNonDefaultFilters(currentFiltersState, defaultAcademicYear);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setSegmentFilter([]);
    setAcademicYearFilter(defaultAcademicYear);
    setSortField('created_at');
    setSortOrder('desc');
    setContactAttemptsFilter('all');
    setEngagementTierFilter([]);
    setEmptyEmailFilter('all');
    setAttendedByFilter([]);
    setCityFilter([]);
    setStudentCountFilter(null);
    setCountValue('');
    setCountValueTo('');
    setCountOp('gt');
  };

  const handleRemoveFilterChip = (chip: FilterChip) => {
    switch (chip.type) {
      case 'search':
        setSearchTerm('');
        break;
      case 'academicYear':
        setAcademicYearFilter((prev) => prev.filter((y) => y !== chip.value));
        break;
      case 'status':
        setStatusFilter((prev) => prev.filter((s) => s !== chip.value));
        break;
      case 'segment':
        setSegmentFilter((prev) => prev.filter((s) => s !== chip.value));
        break;
      case 'contactAttempts':
        setContactAttemptsFilter('all');
        break;
      case 'engagement':
        setEngagementTierFilter((prev) => prev.filter((t) => t !== chip.value));
        break;
      case 'email':
        setEmptyEmailFilter('all');
        break;
      case 'attendedBy':
        setAttendedByFilter((prev) => prev.filter((a) => a !== chip.value));
        break;
      case 'city':
        setCityFilter((prev) => prev.filter((c) => c !== chip.value));
        break;
      case 'studentCount':
        setStudentCountFilter(null);
        setCountValue('');
        setCountValueTo('');
        break;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Filtre e gerencie as escolas do ano letivo selecionado
          </p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="shrink-0 border-primary/25 text-primary hover:bg-primary/5">
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      <Card className="relative overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
        <div className="absolute left-0 top-0 h-full w-1.5 bg-primary" />
        <CardHeader className="pb-3 pl-5">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Busque e refine a lista — use + Filtros para opções avançadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pl-5">
          {/* Linha principal: essenciais */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="shrink-0 lg:w-36">
              <MultiSelect
                options={availableAcademicYears.map(year => ({
                  value: year,
                  label: `${year}${year === getCurrentAcademicYear() ? ' (Vigente)' : ''}`
                }))}
                selected={academicYearFilter}
                onChange={setAcademicYearFilter}
                placeholder="Ano Letivo"
                className="w-full"
              />
            </div>

            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por nome, código ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-primary/20 bg-white pl-10 shadow-sm focus-visible:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:shrink-0 lg:items-center">
              <div className="lg:w-44">
                <MultiSelect
                  options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Status"
                  className="w-full"
                />
              </div>

              <div className="lg:w-52">
                <MultiSelect
                  options={availableCities.map((c) => ({ value: c, label: c }))}
                  selected={cityFilter}
                  onChange={setCityFilter}
                  placeholder="Cidade"
                  className="w-full"
                />
              </div>



              <Button
                type="button"
                variant="outline"
                onClick={() => setFiltersExpanded((prev) => !prev)}
                className="col-span-2 h-10 border-dashed border-primary/30 text-primary hover:bg-primary/5 sm:col-span-1"
              >
                {filtersExpanded ? '− Filtros' : '+ Filtros'}
              </Button>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleRemoveFilterChip(chip)}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <X className="h-3 w-3 shrink-0 opacity-70" />
                </button>
              ))}
              {showClearFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          )}

          {/* Filtros avançados (expandidos) */}
          {filtersExpanded && (
            <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <MultiSelect
                options={availableSegments.map((level) => ({ value: level, label: getSegmentLabel(level) }))}
                selected={segmentFilter}
                onChange={handleSegmentFilterChange}
                placeholder="Segmento"
                className="w-full"
              />

              {/* Número de alunos */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex flex-wrap gap-2 items-end">
                <Select value={countOp} onValueChange={(v) => setCountOp(v as StudentCountOperator)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STUDENT_COUNT_OP_LABELS) as StudentCountOperator[]).map((op) => (
                      <SelectItem key={op} value={op}>{STUDENT_COUNT_OP_LABELS[op]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Qtd"
                  value={countValue}
                  onChange={(e) => setCountValue(e.target.value)}
                  className="w-24"
                />
                {countOp === 'between' && (
                  <Input
                    type="number"
                    min={0}
                    placeholder="Até"
                    value={countValueTo}
                    onChange={(e) => setCountValueTo(e.target.value)}
                    className="w-24"
                  />
                )}
                <Button type="button" size="sm" onClick={applyStudentCountFilter} className="h-10">
                  Aplicar
                </Button>
                {studentCountFilter !== null && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setStudentCountFilter(null); setCountValue(''); setCountValueTo(''); }} className="h-10 text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <Select value={contactAttemptsFilter} onValueChange={(v) => setContactAttemptsFilter(v as 'all' | '0' | '1' | '2' | '3' | '4' | 'ge_5')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tentativas de contato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tentativas de contato</SelectItem>
                  <SelectItem value="0">0 contatos</SelectItem>
                  <SelectItem value="1">1 contato</SelectItem>
                  <SelectItem value="2">2 contatos</SelectItem>
                  <SelectItem value="3">3 contatos</SelectItem>
                  <SelectItem value="4">4 contatos</SelectItem>
                  <SelectItem value="ge_5">≥ 5 contatos</SelectItem>
                </SelectContent>
              </Select>

              <MultiSelect
                options={[
                  { value: 'alto', label: `Alto (≥${ENGAGEMENT_WEIGHTS.tierHigh})` },
                  { value: 'medio', label: `Médio (${ENGAGEMENT_WEIGHTS.tierMedium}–${ENGAGEMENT_WEIGHTS.tierHigh - 1})` },
                  { value: 'baixo', label: `Baixo (1–${ENGAGEMENT_WEIGHTS.tierMedium - 1})` },
                ]}
                selected={engagementTierFilter}
                onChange={setEngagementTierFilter}
                placeholder="Nota / Engajamento"
                className="w-full"
              />

              <MultiSelect
                options={attendants.map((a) => ({ value: a.id, label: a.name || 'Sem nome' }))}
                selected={attendedByFilter}
                onChange={setAttendedByFilter}
                placeholder="Atendido por"
                className="w-full"
              />

              <Select
                value={emptyEmailFilter}
                onValueChange={(value) => setEmptyEmailFilter(value as 'all' | 'com_email' | 'sem_email')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="E-mail" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="com_email">Com e-mail</SelectItem>
                  <SelectItem value="sem_email">Sem e-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-gray-100">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-base">
            Resultados ({totalCount.toLocaleString('pt-BR')})
            {listLoading && <span className="ml-2 text-sm font-normal text-muted-foreground">Carregando…</span>}
            {totalPages > 1 && !listLoading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — Página {currentPage} de {totalPages} ({startIndex + 1}-
                {endIndex} de {totalCount.toLocaleString('pt-BR')})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 pt-4">
          <div className="min-w-0 space-y-0 lg:hidden divide-y divide-gray-100">
            {currentStudents.map((student) => {
              const unitName = student.units?.name || student.classes?.units?.name || '-';

              return (
                <div
                  key={student.id}
                  className="min-w-0 py-4 first:pt-0 hover:bg-gray-50/50"
                >
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="w-full">
                      {getStatusBadge(
                        student.status,
                        'h-auto w-full max-w-full justify-center whitespace-normal rounded-md px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug'
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="break-words font-medium text-gray-900">
                        {student.student_name}
                      </h3>
                      <p className="text-sm text-gray-600">Código: {student.code}</p>
                      {student.inep_code && (
                        <p className="text-xs text-muted-foreground">INEP: {student.inep_code}</p>
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5 text-sm text-gray-600">
                      <p className="break-words"><strong>Unidade:</strong> {unitName}</p>
                      <p className="break-words"><strong>Cidade:</strong> {student.city || '-'}</p>
                      <p className="break-words"><strong>Total de Alunos:</strong> {student.total_students_count ?? 0}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      <div>Infantil: {student.infantil_count ?? 0}</div>
                      <div>EF1: {student.ef1_count ?? 0}</div>
                      <div>EF2: {student.ef2_count ?? 0}</div>
                      <div>Ensino Médio: {student.medio_count ?? 0}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewStudent(student)}
                        className="h-8 px-2 text-xs"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5 shrink-0" />
                        Resumo
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenStudentPage(student.id)}
                        onContextMenu={(e) => handleContextMenu(e, student.id)}
                        title="Clique esquerdo: abrir na mesma aba | Clique direito: abrir em nova aba"
                        className="h-8 px-2 text-xs"
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5 shrink-0" />
                        Abrir ficha
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden min-w-0 lg:block [&>div]:overflow-x-hidden">
            <Table className="table-fixed w-full">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[15%]" />
                <col className="w-[24%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Escola</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Cidade</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Segmentos</TableHead>
                  <TableHead 
                    className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-700 cursor-pointer select-none hover:text-gray-900 transition-colors"
                    onClick={() => {
                      if (sortField !== 'total_alunos') {
                        setSortField('total_alunos');
                        setSortOrder('desc');
                      } else {
                        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Total Alunos
                      {sortField === 'total_alunos' && (
                        sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Status</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentStudents.map((student) => {
                  const unitName = student.units?.name || student.classes?.units?.name || '-';

                  return (
                    <TableRow key={student.id} className="hover:bg-gray-50/50">
                      <TableCell className="min-w-0 overflow-hidden px-2 py-3 align-top">
                        <p className="line-clamp-2 font-medium leading-snug text-gray-900" title={student.student_name}>
                          {student.student_name}
                        </p>
                        <p className="truncate text-xs text-gray-500">Código: {student.code}</p>
                        {student.inep_code && (
                          <p className="truncate text-xs text-muted-foreground">INEP: {student.inep_code}</p>
                        )}
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden px-2 py-3 align-top text-sm text-gray-600">
                        {[student.city?.trim(), student.estado?.trim()].filter(Boolean).join(' - ') || '-'}
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden px-2 py-3 align-top">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-gray-600">
                          <span className="truncate">Infantil: {student.infantil_count ?? 0}</span>
                          <span className="truncate">EF1: {student.ef1_count ?? 0}</span>
                          <span className="truncate">EF2: {student.ef2_count ?? 0}</span>
                          <span className="truncate">Médio: {student.medio_count ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden px-2 py-3 align-top text-sm font-semibold text-gray-900">
                        {student.total_students_count ?? 0}
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden px-1.5 py-3 align-top">
                        {getStatusBadge(
                          student.status,
                          'block h-auto w-full max-w-full whitespace-normal break-words rounded-md px-1.5 py-0.5 text-center text-[10px] leading-tight line-clamp-3'
                        )}
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden px-2 py-3 align-top">
                        <div className="flex min-w-0 flex-col gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewStudent(student)}
                            className="h-7 min-w-0 flex-1 px-1.5 text-[10px]"
                          >
                            <Eye className="mr-0.5 h-3 w-3 shrink-0" />
                            <span className="truncate">Resumo</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenStudentPage(student.id)}
                            onContextMenu={(e) => handleContextMenu(e, student.id)}
                            title="Clique esquerdo: abrir na mesma aba | Clique direito: abrir em nova aba"
                            className="h-7 min-w-0 flex-1 border-primary/25 px-1.5 text-[10px] text-primary hover:bg-primary/5"
                          >
                            <ExternalLink className="mr-0.5 h-3 w-3 shrink-0" />
                            <span className="truncate">Abrir ficha</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* Componente de Paginação */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => handlePageChange(currentPage - 1)}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {getVisiblePages().map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => handlePageChange(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => handlePageChange(currentPage + 1)}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <StudentDialog
          student={selectedStudent}
          open={showStudentDialog}
          onClose={handleCloseDialog}
          onUpdate={handleUpdateStudent}
        />
      )}
    </div>
  );
};
