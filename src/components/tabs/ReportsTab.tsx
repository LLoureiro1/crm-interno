
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, CheckCircle2, Users, Calendar, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { getCurrentDate } from '@/utils/dateUtils';
import {
  isActivityInReportPeriod,
  isCreatedInReportPeriod,
  type ReportDateFilterState,
} from '@/utils/reportDateFilter';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnitAccess } from '@/hooks/useUnitAccess';
import {
  REPORT_SECTIONS,
  type ReportSectionId,
  useDashboardNav,
} from '@/contexts/DashboardNavContext';
import {
  getSegmentLabel,
  getSeriesIdsForSegment,
  sortSegments,
} from '@/utils/educationLevel';
import {
  aggregateReportStatusCounts,
  normalizeReportStatus,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUS_REPORT_ORDER,
} from '@/utils/studentStatus';

type Unit = Tables<'units'>;
type Series = Tables<'series'>;
type Student = Tables<'students'> & {
  units?: { id: string; name: string } | null;
  classes?: {
    id: string;
    name: string;
    unit_id: string;
    series_id: string;
    series: {
      id: string;
      name: string;
      level: string;
      ordenar: number;
    } | null;
    units: { id: string; name: string } | null;
  } | null;
};

interface ReportData {
  totalInscricoes: number;
  agendamentosHoje: number;
  matriculados: number;
  statusCounts: { [key: string]: number };
}

export const ReportsTab = () => {
  const { profile } = useAuth();
  const { fullAccess, allowedUnitIds, getVisibleUnits, loading: unitAccessLoading } = useUnitAccess();
  const { setReportsActiveSection, reportsScrollToSectionRef } = useDashboardNav();
  const [units, setUnits] = useState<Unit[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');

  const [dateFilterType, setDateFilterType] = useState<string>('default');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const dateFilter: ReportDateFilterState = useMemo(
    () => ({
      dateFilterType: dateFilterType as ReportDateFilterState['dateFilterType'],
      customStartDate,
      customEndDate,
    }),
    [dateFilterType, customStartDate, customEndDate]
  );

  const isDateInPeriod = (dateStr: string | null | undefined) =>
    isCreatedInReportPeriod(dateStr, dateFilter);

  const isActivityInPeriod = (
    createdAt: string | null | undefined,
    updatedAt: string | null | undefined
  ) => isActivityInReportPeriod(createdAt, updatedAt, dateFilter);

  const availableSegments = useMemo(
    () => sortSegments(series.map((s) => s.level)),
    [series]
  );

  const filteredSeriesOptions = useMemo(() => {
    if (selectedSegment === 'all') return series;
    return series.filter((s) => s.level === selectedSegment);
  }, [series, selectedSegment]);

  const handleSegmentChange = (value: string) => {
    setSelectedSegment(value);
    setSelectedSeries('all');
  };

  const [reportData, setReportData] = useState<ReportData>({
    totalInscricoes: 0,
    agendamentosHoje: 0,
    matriculados: 0,
    statusCounts: {}
  });
  const [studentsData, setStudentsData] = useState<Student[]>([]);
  const [todayAppointmentsStudents, setTodayAppointmentsStudents] = useState<Student[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState<string>('');
  const [dialogStudents, setDialogStudents] = useState<Student[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    fetchSeries();
  }, []);

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    if (unitAccessLoading) return;
    fetchReportData();
  }, [selectedUnit, selectedSegment, selectedSeries, fullAccess, allowedUnitIds, unitAccessLoading, dateFilterType, customStartDate, customEndDate, series]);

  useEffect(() => {
    const navOffset = 64;

    const getActiveSectionId = (): ReportSectionId => {
      const sections = REPORT_SECTIONS.map(({ id }) => ({
        id,
        element: document.getElementById(id),
      })).filter((section): section is { id: ReportSectionId; element: HTMLElement } => !!section.element);

      if (sections.length === 0) return REPORT_SECTIONS[0].id;

      const scrollBottom = window.scrollY + window.innerHeight;
      const pageBottom = document.documentElement.scrollHeight;
      const atPageBottom = pageBottom - scrollBottom <= 80;

      if (atPageBottom) {
        return sections[sections.length - 1].id;
      }

      let activeId = sections[0].id;

      for (const { id, element } of sections) {
        if (element.getBoundingClientRect().top <= navOffset) {
          activeId = id;
        }
      }

      return activeId;
    };

    const handleScroll = () => {
      setReportsActiveSection(getActiveSectionId());
      setShowBackToTop(window.scrollY > 300);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [setReportsActiveSection]);

  const scrollToSection = useCallback((sectionId: ReportSectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setReportsActiveSection(sectionId);
  }, [setReportsActiveSection]);

  useEffect(() => {
    reportsScrollToSectionRef.current = scrollToSection;
    return () => {
      reportsScrollToSectionRef.current = null;
    };
  }, [scrollToSection, reportsScrollToSectionRef]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setReportsActiveSection(REPORT_SECTIONS[0].id);
  }, [setReportsActiveSection]);

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    if (data) setUnits(data);
  };

  const fetchSeries = async () => {
    const { data } = await supabase
      .from('series')
      .select('*')
      .order('ordenar', { ascending: true });
    if (data) setSeries(data);
  };

  const visibleUnits = useMemo(() => getVisibleUnits(units), [units, getVisibleUnits]);

  const fetchReportData = async () => {
    const filterByUnit = selectedUnit !== 'all';
    const needsClassFilter = selectedSeries !== 'all' || selectedSegment !== 'all';

    const buildStudentsQuery = () => {
      // Sem filtro de série/segmento: não faz join em classes (escolas B2B sem class_id).
      let q = needsClassFilter
        ? supabase.from('students').select(`
            id, status, unit_id, created_at, updated_at, class_id, phone, student_name,
            units:unit_id(id, name),
            classes!inner(
              id, name, unit_id, series_id,
              series:series_id(id, name, level, ordenar),
              units(id, name)
            )
          `)
        : supabase.from('students').select(`
            id, status, unit_id, created_at, updated_at, class_id, phone, student_name,
            units:unit_id(id, name)
          `);

      if (filterByUnit) {
        q = q.eq('unit_id', selectedUnit);
      } else if (!fullAccess) {
        if (allowedUnitIds.length > 0) {
          q = q.in('unit_id', allowedUnitIds);
        } else if (profile?.unit_id) {
          q = q.eq('unit_id', profile.unit_id);
        }
      }

      if (selectedSeries !== 'all') {
        q = q.eq('classes.series_id', selectedSeries);
      } else if (selectedSegment !== 'all') {
        const seriesIdsInSegment = getSeriesIdsForSegment(series, selectedSegment);
        if (seriesIdsInSegment.length > 0) {
          q = q.in('classes.series_id', seriesIdsInSegment);
        } else {
          q = q.eq('classes.series_id', '00000000-0000-0000-0000-000000000000');
        }
      }

      return q;
    };

    const pageSize = 1000;
    const allStudents: Student[] = [];
    let offset = 0;
    let studentsError: { message: string } | null = null;

    while (true) {
      const { data: page, error } = await buildStudentsQuery()
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) {
        studentsError = error;
        break;
      }
      const rows = (page || []) as Student[];
      allStudents.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    if (studentsError) {
      console.error('Erro ao buscar escolas para relatórios:', studentsError);
      return;
    }

    const students = allStudents;
    const studentsValid = students.filter((s) => s.status !== 'cadastro_invalido');
    setStudentsData(students);

    const today = getCurrentDate();
    const totalInscricoes = studentsValid.filter(
      (s) => s.status !== 'processo_anos_anteriores' && isDateInPeriod(s.created_at)
    ).length;
    const matriculados = students.filter(
      (s) => s.status === 'matriculado' && isActivityInPeriod(s.created_at, s.updated_at)
    ).length;
    const statusCounts = aggregateReportStatusCounts(students);

    // Contagens imediatamente — não bloqueia em agendamentos
    setReportData((prev) => ({
      ...prev,
      totalInscricoes,
      matriculados,
      statusCounts,
    }));

    let appQuery = supabase.from('appointments').select('id, student_id, appointment_date');
    if (dateFilterType === 'default' || dateFilterType === 'today') {
      appQuery = appQuery.eq('appointment_date', today);
    } else if (dateFilterType === '7days') {
      const sevenDaysAgo = new Date(today + 'T00:00:00');
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      appQuery = appQuery
        .gte('appointment_date', sevenDaysAgo.toISOString().substring(0, 10))
        .lte('appointment_date', today);
    } else if (dateFilterType === '30days') {
      const thirtyDaysAgo = new Date(today + 'T00:00:00');
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      appQuery = appQuery
        .gte('appointment_date', thirtyDaysAgo.toISOString().substring(0, 10))
        .lte('appointment_date', today);
    } else if (dateFilterType === 'custom' && customStartDate && customEndDate) {
      appQuery = appQuery.gte('appointment_date', customStartDate).lte('appointment_date', customEndDate);
    }

    const studentIds = new Set(students.map((s) => s.id));
    const { data: appointments } = await appQuery;
    const filteredAppointments = (appointments || []).filter((app) => studentIds.has(app.student_id));
    setTodayAppointmentsStudents(
      students.filter((s) => filteredAppointments.some((app) => app.student_id === s.id))
    );
    setReportData((prev) => ({
      ...prev,
      agendamentosHoje: filteredAppointments.length,
    }));
  };

  const getFilteredStudents = (filterType: string) => {
    switch (filterType) {
      case 'total':
        return studentsData.filter(s => s.status !== 'cadastro_invalido' && isDateInPeriod(s.created_at));
      case 'matriculados':
        return studentsData.filter(
          (s) =>
            s.status === 'matriculado' && isActivityInPeriod(s.created_at, s.updated_at)
        );
      default:
        return [];
    }
  };

  // Alinha ao statusCounts: totais atuais, com aliases de nomenclatura
  const getStudentsByStatus = (status: string) => {
    return studentsData.filter((s) => normalizeReportStatus(s.status) === status);
  };

  // Extraído para fora do componente principal para evitar recriação
  const StudentsTable = ({ students, statusLabels }: { students: Student[], statusLabels: { [key: string]: string } }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Escola</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Turma</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => (
          <TableRow key={student.id}>
            <TableCell>
              <Link
                to={`/student/${student.id}`}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {student.student_name}
              </Link>
            </TableCell>
            <TableCell>{student.phone || '—'}</TableCell>
            <TableCell>{student.classes?.name || '—'}</TableCell>
            <TableCell>
              {student.classes?.units?.name || student.units?.name || '—'}
            </TableCell>
            <TableCell>{statusLabels[student.status] || student.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const statusLabels = STUDENT_STATUS_LABELS;

  const getStatusCardStyle = (status: string) => {
    const styles: Record<string, { card: string; count: string; label: string }> = {
      nenhum_agendamento: { card: 'border-slate-200 bg-slate-50', count: 'text-slate-400', label: 'text-slate-500' },
      confirmado: { card: 'border-slate-200 bg-slate-100/80', count: 'text-slate-600', label: 'text-slate-700' },
      atendimento_agendado: { card: 'border-blue-100 bg-blue-50/60', count: 'text-blue-500', label: 'text-blue-600' },
      faltou_ao_atendimento: { card: 'border-violet-100 bg-violet-50/60', count: 'text-violet-400', label: 'text-violet-500' },
      atendimento_recentemente: { card: 'border-blue-100 bg-blue-50', count: 'text-[#1437cc]', label: 'text-[#1437cc]' },
      atendimento_ha_mais_de_uma_semana: { card: 'border-orange-100 bg-orange-50', count: 'text-orange-500', label: 'text-orange-600' },
      portfolio_enviado: { card: 'border-sky-100 bg-sky-50', count: 'text-sky-500', label: 'text-sky-600' },
      cadastro_invalido: { card: 'border-gray-200 bg-gray-50', count: 'text-gray-500', label: 'text-gray-600' },
      desistente: { card: 'border-red-100 bg-red-50', count: 'text-red-600', label: 'text-red-600' },
      matriculado: { card: 'border-green-100 bg-green-50', count: 'text-green-500', label: 'text-green-600' },
    };
    return styles[status] ?? { card: 'border-gray-200 bg-gray-50', count: 'text-gray-900', label: 'text-gray-600' };
  };

  const openDialog = (students: Student[], title: string) => {
    setDialogStudents(students);
    setDialogTitle(title);
    setDialogOpen(true);
  };

  const getAgendamentosLabel = () => {
    if (dateFilterType === 'default') return 'Agendamentos Hoje';
    if (dateFilterType === 'all') return 'Agendamentos (Todos)';
    if (dateFilterType === 'today') return 'Agendamentos Hoje';
    if (dateFilterType === '7days') return 'Agendamentos (7 dias)';
    if (dateFilterType === '30days') return 'Agendamentos (30 dias)';
    if (dateFilterType === 'custom') return 'Agendamentos (Período)';
    return 'Agendamentos Hoje';
  };

  return (
    <div className="relative -mt-2 md:-mt-4 lg:-mt-6">
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Painel Operacional</h2>
            <p className="text-sm text-muted-foreground">Visão geral das inscrições e status dos alunos</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-48 rounded-xl border-gray-200 bg-white shadow-sm">
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="all">Todas as unidades</SelectItem>
              {visibleUnits.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSegment} onValueChange={handleSegmentChange}>
            <SelectTrigger className="w-52 rounded-xl border-gray-200 bg-white shadow-sm">
              <SelectValue placeholder="Selecione o segmento" />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {availableSegments.map((level) => (
                <SelectItem key={level} value={level}>
                  {getSegmentLabel(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSeries} onValueChange={setSelectedSeries}>
            <SelectTrigger className="w-48 rounded-xl border-gray-200 bg-white shadow-sm">
              <SelectValue placeholder="Selecione a série" />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="all">Todas as séries</SelectItem>
              {filteredSeriesOptions.map(serie => (
                <SelectItem key={serie.id} value={serie.id}>{serie.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilterType} onValueChange={setDateFilterType}>
            <SelectTrigger className="w-48 rounded-xl border-gray-200 bg-white shadow-sm">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="default">Selecione o período...</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {dateFilterType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="flex h-10 w-[140px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="text-sm text-muted-foreground">até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="flex h-10 w-[140px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}
        </div>

        <section id="kpis" className="scroll-mt-20 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-3">
            <div className="h-full cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDialog(getFilteredStudents('total'), 'Total de Inscrições')}>
              <Card className="relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
                <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total de Escolas</CardTitle>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tabular-nums text-gray-900">{reportData.totalInscricoes}</div>
                </CardContent>
              </Card>
            </div>

            <div className="h-full cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDialog(todayAppointmentsStudents, getAgendamentosLabel())}>
              <Card className="relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
                <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{getAgendamentosLabel()}</CardTitle>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tabular-nums text-gray-900">{reportData.agendamentosHoje}</div>
                </CardContent>
              </Card>
            </div>

            <div className="h-full cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDialog(getFilteredStudents('matriculados'), 'Alunos Matriculados')}>
              <Card className="relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
                <div className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fechados</CardTitle>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tabular-nums text-emerald-700">{reportData.matriculados}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="status" className="scroll-mt-20">
          <Card className="border-0 shadow-sm ring-1 ring-gray-100">
            <CardHeader>
              <CardTitle className="text-primary">Escolas por Status</CardTitle>
              <CardDescription>Distribuição detalhada dos status das escolas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                {STUDENT_STATUS_REPORT_ORDER.map((status) => {
                  const style = getStatusCardStyle(status);
                  return (
                    <div
                      key={status}
                      className={cn(
                        'cursor-pointer rounded-lg border p-4 text-center transition-shadow hover:shadow-md',
                        style.card
                      )}
                      onClick={() =>
                        openDialog(
                          getStudentsByStatus(status),
                          `Escolas com Status: ${statusLabels[status] || status}`
                        )
                      }
                    >
                      <div className={cn('text-2xl font-bold tabular-nums', style.count)}>
                        {reportData.statusCounts[status] ?? 0}
                      </div>
                      <div className={cn('mt-1 text-xs font-semibold leading-snug', style.label)}>
                        {statusLabels[status] || status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>
            <StudentsTable students={dialogStudents} statusLabels={statusLabels} />
          </DialogContent>
        </Dialog>

        {showBackToTop && (
          <Button
            type="button"
            onClick={scrollToTop}
            size="icon"
            className="fixed bottom-6 right-6 z-30 rounded-full bg-primary shadow-lg hover:bg-primary/90"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
