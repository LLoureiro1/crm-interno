import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Eye, Calendar, ExternalLink, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentDialog } from '@/components/StudentDialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Tables } from '@/integrations/supabase/types';
import { formatDateForDisplay, formatRegistrationTimeForDisplay, getCurrentDate } from '@/utils/dateUtils';
import { formatCpf } from '@/utils/cpf';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUnitAccess } from '@/hooks/useUnitAccess';
import { getSegmentLabel, sortSegments } from '@/utils/educationLevel';
import { ENGAGEMENT_WEIGHTS, matchesScoreTierFilter } from '@/utils/engagementScore';
import {
  buildFilterChips,
  getCurrentAcademicYear,
  getDefaultAcademicYearFilter,
  hasAdvancedFiltersActive,
  hasNonDefaultFilters,
  loadStudentsListFilters,
  saveStudentsListFilters,
  STATUS_LABELS,
  type FilterChip,
} from '@/utils/studentsListFilters';

type Student = Tables<'students'> & {
  units?: Tables<'units'> | null;
  classes?: (Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  }) | null;
  student_phones?: { phone_number: string }[];
};

type ExamDate = Tables<'exam_dates'> & {
  units: Tables<'units'>;
};

export const StudentsTab = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { getVisibleUnits, fullAccess, allowedUnitIds } = useUnitAccess();
  const cachedFiltersRef = useRef(loadStudentsListFilters());
  const cachedFilters = cachedFiltersRef.current;
  const skipPageResetRef = useRef(!!cachedFilters);

  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [examDates, setExamDates] = useState<ExamDate[]>([]);
  const [searchTerm, setSearchTerm] = useState(cachedFilters?.searchTerm ?? '');
  const [statusFilter, setStatusFilter] = useState<string[]>(cachedFilters?.statusFilter ?? []);
  const [unitFilter, setUnitFilter] = useState<string[]>(cachedFilters?.unitFilter ?? []);
  const [segmentFilter, setSegmentFilter] = useState<string[]>(cachedFilters?.segmentFilter ?? []);
  const [seriesFilter, setSeriesFilter] = useState<string[]>(cachedFilters?.seriesFilter ?? []);
  const [examDateFilter, setExamDateFilter] = useState<string[]>(cachedFilters?.examDateFilter ?? []);
  const [academicYearFilter, setAcademicYearFilter] = useState<string[]>(cachedFilters?.academicYearFilter ?? []);
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [availableAcademicYears, setAvailableAcademicYears] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [sortField, setSortField] = useState<'created_at'>(
    (cachedFilters?.sortField as 'created_at') || 'created_at'
  );
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
  const [attendants, setAttendants] = useState<Tables<'staff_directory'>[]>([]);
  const [attendedByMap, setAttendedByMap] = useState<Record<string, string[]>>({});
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [defaultAcademicYear, setDefaultAcademicYear] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(() =>
    cachedFilters ? hasAdvancedFiltersActive(cachedFilters) : false
  );

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(cachedFilters?.currentPage ?? 1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchStudents();
    fetchUnits();
    fetchSeries();
    fetchExamDates();
    fetchAvailableAcademicYears();
    fetchAttendants();
  }, [fullAccess, allowedUnitIds, profile?.unit_id]);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, statusFilter, unitFilter, segmentFilter, seriesFilter, examDateFilter, academicYearFilter, sortField, sortOrder, contactAttemptsFilter, engagementTierFilter, emptyEmailFilter, attendedByFilter, contactCounts, attendedByMap]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredStudents.length, currentPage, itemsPerPage]);

  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [searchTerm, statusFilter, unitFilter, segmentFilter, seriesFilter, examDateFilter, academicYearFilter, sortField, sortOrder, contactAttemptsFilter, engagementTierFilter, emptyEmailFilter, attendedByFilter]);

  useEffect(() => {
    saveStudentsListFilters({
      searchTerm,
      statusFilter,
      unitFilter,
      segmentFilter,
      seriesFilter,
      examDateFilter,
      academicYearFilter,
      sortField,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      currentPage,
    });
  }, [
    searchTerm,
    statusFilter,
    unitFilter,
    segmentFilter,
    seriesFilter,
    examDateFilter,
    academicYearFilter,
    sortField,
    sortOrder,
    contactAttemptsFilter,
    engagementTierFilter,
    emptyEmailFilter,
    attendedByFilter,
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
    if (newSegments.length > 0 && seriesFilter.length > 0) {
      const allowedIds = new Set(
        series.filter((s) => newSegments.includes(s.level)).map((s) => s.id)
      );
      setSeriesFilter((prev) => prev.filter((id) => allowedIds.has(id)));
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

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        units(*),
        classes(
          *,
          units(*),
          series(*)
        ),
        student_phones(
          phone_number
        )
      `)
      .order('created_at', { ascending: false });
  
    if (error) {
      console.error('Error fetching students:', error);
      return;
    }
  
    const list = (data as Student[]) || [];
    setStudents(list);
    const ids = list.map(s => s.id).filter(Boolean);
    void fetchAttendedByMap(ids);
    try {
      if (ids.length === 0) {
        setContactCounts({});
      } else {
        const { data: attempts, error: attemptsError } = await supabase
          .from('contact_attempts')
          .select('student_id')
          .in('student_id', ids);
        if (attemptsError) {
          console.error('Erro ao buscar tentativas de contato:', attemptsError);
          setContactCounts({});
        } else {
          const counts: Record<string, number> = {};
          (attempts || []).forEach((a: any) => {
            const id = a.student_id;
            counts[id] = (counts[id] || 0) + 1;
          });
          setContactCounts(counts);
        }
      }
    } catch (e) {
      console.error('Erro ao calcular contagem de tentativas:', e);
      setContactCounts({});
    }
  };

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    if (data) setUnits(data);
  };

  const visibleUnits = getVisibleUnits(units);

  const fetchSeries = async () => {
    const { data } = await supabase
      .from('series')
      .select('*')
      .order('ordenar', { ascending: true });
    if (data) setSeries(data);
  };

  const fetchAvailableAcademicYears = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('ano_letivo')
      .not('ano_letivo', 'is', null)
      .order('ano_letivo', { ascending: false });

    if (error) {
      console.error('Error fetching academic years:', error);
      return;
    }

    const years = Array.from(new Set(data.map(item => item.ano_letivo))).filter(Boolean) as string[];
    setAvailableAcademicYears(years);

    const defaultYear = getDefaultAcademicYearFilter(years);
    setDefaultAcademicYear(defaultYear);

    if (cachedFiltersRef.current?.academicYearFilter?.length) {
      return;
    }

    if (defaultYear.length > 0) {
      setAcademicYearFilter(defaultYear);
    }
  };

  const fetchExamDates = async () => {
    const { data } = await supabase
      .from('exam_dates')
      .select(`
        *,
        units(*)
      `)
      .order('exam_date', { ascending: true });
    
    if (data) setExamDates(data as ExamDate[]);
  };

  const filterStudents = () => {
    let filtered = students;

    // Excluir "Cadastro Inválido" por padrão, a menos que esteja explicitamente selecionado
    const includeInvalid = statusFilter.includes('cadastro_invalido');
    if (!includeInvalid) {
      filtered = filtered.filter(student => student.status !== 'cadastro_invalido');
    }

    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      const digits = searchTerm.replace(/\D/g, '');
      const hasDigits = digits.length >= 3;

      filtered = filtered.filter(student => {
        const matchesText =
          student.student_name.toLowerCase().includes(termLower) ||
          (student.code?.toLowerCase().includes(termLower) || false);

        const primaryPhoneDigits = (student.phone || '').replace(/\D/g, '');
        const additionalPhonesDigits = (student.student_phones || []).map(p => (p.phone_number || '').replace(/\D/g, ''));
        const matchesPhone = hasDigits && (
          (primaryPhoneDigits.includes(digits)) ||
          additionalPhonesDigits.some(p => p.includes(digits))
        );

        return matchesText || matchesPhone;
      });
    }

    if (statusFilter.length > 0) {
      filtered = filtered.filter(student => statusFilter.includes(student.status!));
    }

    if (unitFilter.length > 0) {
      filtered = filtered.filter(student =>
        unitFilter.includes(student.unit_id!) || unitFilter.includes(student.classes?.unit_id!)
      );
    }

    if (seriesFilter.length > 0) {
      filtered = filtered.filter(student => seriesFilter.includes(student.classes?.series_id!));
    } else if (segmentFilter.length > 0) {
      filtered = filtered.filter(student =>
        segmentFilter.includes(student.classes?.series?.level ?? '')
      );
    }

    if (examDateFilter.length > 0) {
      const today = getCurrentDate();
      filtered = filtered.filter(student => {
        return examDateFilter.some(filter => {
          switch (filter) {
            case 'sem_data':
              return !student.exam_date;
            case 'hoje':
              return student.exam_date === today;
            case 'futuras':
              return student.exam_date && student.exam_date > today;
            case 'passadas':
              return student.exam_date && student.exam_date < today;
            default:
              if (filter.startsWith('date_')) {
                const targetDate = filter.replace('date_', '');
                return student.exam_date === targetDate;
              }
              return false;
          }
        });
      });
    }

    // Filtro por ano letivo (filtro supremo)
    if (academicYearFilter.length > 0) {
      filtered = filtered.filter(student => academicYearFilter.includes(student.ano_letivo!));
    }

    // Filtro por número de tentativas de contato
    if (contactAttemptsFilter !== 'all') {
      if (contactAttemptsFilter === 'ge_5') {
        filtered = filtered.filter(student => (contactCounts[student.id] || 0) >= 5);
      } else {
        const target = parseInt(contactAttemptsFilter, 10);
        filtered = filtered.filter(student => (contactCounts[student.id] || 0) === target);
      }
    }

    if (engagementTierFilter.length > 0) {
      filtered = filtered.filter((student) =>
        matchesScoreTierFilter(student.engagement_score, engagementTierFilter)
      );
    }

    if (emptyEmailFilter === 'sem_email') {
      filtered = filtered.filter((student) => !student.email?.trim());
    } else if (emptyEmailFilter === 'com_email') {
      filtered = filtered.filter((student) => !!student.email?.trim());
    }

    if (attendedByFilter.length > 0) {
      filtered = filtered.filter((student) => {
        const attendantsForStudent = attendedByMap[student.id] || [];
        return attendedByFilter.some((userId) => attendantsForStudent.includes(userId));
      });
    }

    filtered = filtered.slice().sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    });

    setFilteredStudents(filtered);
  };

  const exportToExcel = () => {
    const exportData = filteredStudents.map(student => ({
      'Código': student.code,
      'Código INEP': student.inep_code || '',
      'Nome da Escola': student.student_name,
      'Contato Principal': student.responsible_name || '',
      'Telefone': student.phone,
      'Email': student.email || '',
      'Cidade': student.city || '',
      'Qtd Infantil': student.infantil_count || 0,
      'Qtd EF1': student.ef1_count || 0,
      'Qtd EF2': student.ef2_count || 0,
      'Qtd Ensino Médio': student.medio_count || 0,
      'Total de Alunos': student.total_students_count || 0,
      'Status': STATUS_LABELS[student.status] || student.status,
      'Data de Cadastro': student.created_at ? new Date(student.created_at).toLocaleDateString('pt-BR') : '',
      'Ano Letivo': student.ano_letivo || '',
      'Tag': student.tag || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Escolas');
    XLSX.writeFile(wb, `escolas_${getCurrentDate()}.xlsx`);
  };

  const getStatusBadge = (status: string, className?: string) => {
    const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "purple" | "warning" | "ausente" | "cadastro_invalido" | "processo_anos_anteriores" } } = {
      'nao_confirmado': { label: 'Lead Frio', variant: 'outline' },
      'confirmado': { label: 'Lead Quente', variant: 'secondary' },
      'cadastro_invalido': { label: 'Sem Perfil / Inválido', variant: 'cadastro_invalido' },
      'matriculado': { label: 'Parceria Fechada', variant: 'success' },
      'desistente': { label: 'Negociação Perdida', variant: 'destructive' },
      'nenhum_agendamento': { label: 'Sem Contato', variant: 'outline' },
      'atendimento_agendado': { label: 'Reunião Agendada', variant: 'secondary' },
      'faltou_ao_atendimento': { label: 'Reunião Desmarcada', variant: 'purple' },
      'atendimento_recentemente': { label: 'Proposta Apresentada', variant: 'default' },
      'atendimento_ha_mais_de_uma_semana': { label: 'Aguardando Retorno', variant: 'warning' },
      'ausente': { label: 'Sem Resposta', variant: 'ausente' },
      'processo_anos_anteriores': { label: 'Contatos Anteriores', variant: 'processo_anos_anteriores' }
    };

    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return (
      <Badge variant={config.variant} className={className} title={config.label}>
        {config.label}
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
      unitFilter,
      segmentFilter,
      seriesFilter,
      examDateFilter,
      academicYearFilter,
      sortField,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      currentPage,
    });
    navigate(`/student/${studentId}`);
  };

  const handleOpenStudentPageInNewTab = (studentId: string) => {
    const url = `/student/${studentId}`;
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
    fetchStudents();
  };

  // Funções de paginação
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);

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

  // Agrupar datas de prova únicas
  const uniqueExamDates = Array.from(
    new Map(examDates.map(ed => [ed.exam_date, ed])).values()
  );

  const examDateLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    uniqueExamDates.forEach((date) => {
      labels[`date_${date.exam_date}`] = formatDateForDisplay(date.exam_date);
    });
    return labels;
  }, [uniqueExamDates]);

  const currentFiltersState = useMemo(
    () => ({
      searchTerm,
      statusFilter,
      unitFilter,
      segmentFilter,
      seriesFilter,
      examDateFilter,
      academicYearFilter,
      sortField,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      currentPage,
    }),
    [
      searchTerm,
      statusFilter,
      unitFilter,
      segmentFilter,
      seriesFilter,
      examDateFilter,
      academicYearFilter,
      sortField,
      sortOrder,
      contactAttemptsFilter,
      engagementTierFilter,
      emptyEmailFilter,
      attendedByFilter,
      currentPage,
    ]
  );

  const activeFilterChips = useMemo(
    () =>
      buildFilterChips(currentFiltersState, {
        defaultAcademicYear,
        unitNames: Object.fromEntries(visibleUnits.map((u) => [u.id, u.name || 'Sem nome'])),
        seriesNames: Object.fromEntries(series.map((s) => [s.id, s.name || 'Sem nome'])),
        segmentNames: Object.fromEntries(
          availableSegments.map((level) => [level, getSegmentLabel(level)])
        ),
        attendantNames: Object.fromEntries(attendants.map((a) => [a.id, a.name || 'Sem nome'])),
        examDateLabels,
      }),
    [
      currentFiltersState,
      defaultAcademicYear,
      visibleUnits,
      series,
      availableSegments,
      attendants,
      examDateLabels,
    ]
  );

  const showClearFilters = hasNonDefaultFilters(currentFiltersState, defaultAcademicYear);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setUnitFilter([]);
    setSegmentFilter([]);
    setSeriesFilter([]);
    setExamDateFilter([]);
    setAcademicYearFilter(defaultAcademicYear);
    setSortField('created_at');
    setSortOrder('desc');
    setContactAttemptsFilter('all');
    setEngagementTierFilter([]);
    setEmptyEmailFilter('all');
    setAttendedByFilter([]);
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
      case 'unit':
        setUnitFilter((prev) => prev.filter((u) => u !== chip.value));
        break;
      case 'segment':
        setSegmentFilter((prev) => prev.filter((s) => s !== chip.value));
        break;
      case 'series':
        setSeriesFilter((prev) => prev.filter((s) => s !== chip.value));
        break;
      case 'examDate':
        setExamDateFilter((prev) => prev.filter((e) => e !== chip.value));
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
      case 'sort':
        setSortField('created_at');
        setSortOrder('desc');
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

              <div className="lg:w-44">
                <MultiSelect
                  options={visibleUnits.filter(Boolean).map(unit => ({ value: unit.id, label: unit.name || 'Sem nome' }))}
                  selected={unitFilter}
                  onChange={setUnitFilter}
                  placeholder="Unidade"
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
                options={availableSegments.map((level) => ({
                  value: level,
                  label: getSegmentLabel(level),
                }))}
                selected={segmentFilter}
                onChange={handleSegmentFilterChange}
                placeholder="Segmento"
                className="w-full"
              />

              <MultiSelect
                options={filteredSeriesOptions}
                selected={seriesFilter}
                onChange={setSeriesFilter}
                placeholder="Série"
                className="w-full"
              />

              <MultiSelect
                options={[
                  { value: 'sem_data', label: 'Sem Data' },
                  { value: 'hoje', label: 'Hoje' },
                  { value: 'futuras', label: 'Futuras' },
                  { value: 'passadas', label: 'Passadas' },
                  ...uniqueExamDates.map(date => ({
                    value: `date_${date.exam_date}`,
                    label: formatDateForDisplay(date.exam_date),
                  })),
                ]}
                selected={examDateFilter}
                onChange={setExamDateFilter}
                placeholder="Data da Prova"
                className="w-full"
              />

              <Select
                value={`${sortField}:${sortOrder}`}
                onValueChange={(v) => {
                  const [field, order] = v.split(':') as ['created_at', 'desc' | 'asc'];
                  setSortField(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Inscrições" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at:desc">Inscrições mais recentes</SelectItem>
                  <SelectItem value="created_at:asc">Inscrições mais antigas</SelectItem>
                </SelectContent>
              </Select>

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
            Resultados ({filteredStudents.length})
            {totalPages > 1 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — Página {currentPage} de {totalPages} ({startIndex + 1}-
                {Math.min(endIndex, filteredStudents.length)} de {filteredStudents.length})
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
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Escola</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Unidade</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Cidade</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Segmentos</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">Total Alunos</TableHead>
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
                        {unitName}
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden px-2 py-3 align-top text-sm text-gray-600">
                        {student.city || '-'}
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
