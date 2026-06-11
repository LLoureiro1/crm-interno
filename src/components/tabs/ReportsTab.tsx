
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, UserPlus, ClipboardList, CheckCircle2, Users, Calendar, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { getCurrentDate } from '@/utils/dateUtils';
import {
  getDateYYYYMMDD,
  isActivityInReportPeriod,
  isCreatedInReportPeriod,
  type ReportDateFilterState,
} from '@/utils/reportDateFilter';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  getSegmentLabel,
  getSeriesIdsForSegment,
  sortSegments,
} from '@/utils/educationLevel';
import { StatusFunnelChart } from '@/components/reports/StatusFunnelChart';
import {
  isExcludedFromClassChart,
  type ReportClassRow,
} from '@/utils/classStatusAggregation';
import {
  buildEarliestExamDatesByUnit,
  filterStudentsProximaProva,
  supplementNextExamDatesFromStudents,
} from '@/utils/nextExamReport';

type Unit = Tables<'units'>;
type Series = Tables<'series'>;
type Student = Tables<'students'> & {
  classes: {
    id: string;
    name: string;
    unit_id: string;
    series_id: string;
    series: {
      id: string;
      name: string;
      level: string;
      ordenar: number;
    };
    units: { id: string; name: string };
  };
};

interface ReportData {
  totalInscricoes: number;
  inscritosHoje: number;
  alunosProximaProva: number;
  agendamentosHoje: number;
  matriculados: number;
  globalMatriculados: number;
  totalGoal: number;
  statusCounts: { [key: string]: number };
}

export const ReportsTab = () => {
  const { profile } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [isCentralUser, setIsCentralUser] = useState(false);

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

  // Função para calcular o ano letivo atual
  const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Se é agosto ou depois, o ano letivo é o próximo ano
    if (currentMonth >= 8) {
      return String(currentYear + 1);
    }
    // Caso contrário, é o ano atual
    return String(currentYear);
  };
  const [reportData, setReportData] = useState<ReportData>({
    totalInscricoes: 0,
    inscritosHoje: 0,
    alunosProximaProva: 0,
    agendamentosHoje: 0,
    matriculados: 0,
    globalMatriculados: 0,
    totalGoal: 0,
    statusCounts: {}
  });
  const [studentsData, setStudentsData] = useState<Student[]>([]);
  const [classesData, setClassesData] = useState<ReportClassRow[]>([]);
  const [todayAppointmentsStudents, setTodayAppointmentsStudents] = useState<Student[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState<string>('');
  const [dialogStudents, setDialogStudents] = useState<Student[]>([]);

  useEffect(() => {
    fetchSeries();
  }, []);

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    const checkCentral = async () => {
      if (!profile?.unit_id) {
        setIsCentralUser(false);
        return;
      }

      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('id', profile.unit_id)
        .maybeSingle();

      if (error || !data?.name) {
        setIsCentralUser(false);
        return;
      }

      setIsCentralUser(String(data.name).toLowerCase() === 'central');
    };

    checkCentral();
  }, [profile?.unit_id]);

  useEffect(() => {
    fetchReportData();
  }, [selectedUnit, selectedSegment, selectedSeries, isCentralUser, profile?.unit_id, dateFilterType, customStartDate, customEndDate]);

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

  const visibleUnits = units.filter(unit => {
    if (!profile?.unit_id) return true;
    if (isCentralUser) return true;
    return unit.id === profile.unit_id;
  });

  /** Unidades cujo bloco «Por turma» pode ser exibido (Central vê todas; demais só a própria). */
  const getAllowedUnitIdsForChart = (): string[] | null => {
    if (selectedUnit !== 'all') {
      return [selectedUnit];
    }
    if (isCentralUser) {
      return null;
    }
    if (profile?.unit_id) {
      return [profile.unit_id];
    }
    return visibleUnits.map((u) => u.id);
  };

  // Guardar as próximas datas de prova por unidade para alinhar contagem e lista
  const [nextExamDatesByUnit, setNextExamDatesByUnit] = useState<Record<string, string>>({});

  // Obtém o mapa de próxima prova por unidade e totaliza alunos alinhados a esse critério
  const getNextExamStudentInfoAggregated = async (
    students: Student[],
    unitId?: string
  ): Promise<{ count: number; datesByUnit: Record<string, string> }> => {
    try {
      const today = getCurrentDate();
      const unitIds = unitId
        ? [unitId]
        : Array.from(new Set(students.map((s) => s.unit_id ?? s.classes?.unit_id).filter(Boolean) as string[]));

      if (unitIds.length === 0) {
        return { count: 0, datesByUnit: {} };
      }

      const { data: upcomingDates, error } = await supabase
        .from('exam_dates')
        .select('unit_id, exam_date')
        .gte('exam_date', today)
        .in('unit_id', unitIds)
        .order('exam_date', { ascending: true });

      if (error) {
        console.error('Erro ao buscar datas de prova por unidade:', error);
        return { count: 0, datesByUnit: {} };
      }

      const fromTable = buildEarliestExamDatesByUnit(upcomingDates ?? []);
      const datesByUnit = supplementNextExamDatesFromStudents(students, fromTable, today);
      const count = filterStudentsProximaProva(students, datesByUnit).length;

      return { count, datesByUnit };
    } catch (error) {
      console.error('Erro ao agregar alunos por próxima prova de unidade:', error);
      return { count: 0, datesByUnit: {} };
    }
  };

  const fetchReportData = async () => {
    const filterByUnit = selectedUnit !== 'all';

    let query = supabase.from('students').select(`
      *,
      classes!inner(
        id,
        name,
        unit_id,
        series_id,
        series:series_id(id, name, level, ordenar),
        units!inner(id, name)
      )
    `);

    if (filterByUnit) {
      query = query.eq('unit_id', selectedUnit);
    }

    if (selectedSeries !== 'all') {
      query = query.eq('classes.series_id', selectedSeries);
    } else if (selectedSegment !== 'all') {
      const seriesIdsInSegment = getSeriesIdsForSegment(series, selectedSegment);
      if (seriesIdsInSegment.length > 0) {
        query = query.in('classes.series_id', seriesIdsInSegment);
      } else {
        query = query.eq('classes.series_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    let classesQuery = supabase
      .from('classes')
      .select('id, name, unit_id, series_id, series:series_id(id, name, level, ordenar)');

    const allowedUnitIds = getAllowedUnitIdsForChart();
    if (allowedUnitIds && allowedUnitIds.length > 0) {
      classesQuery = classesQuery.in('unit_id', allowedUnitIds);
    }

    if (selectedSeries !== 'all') {
      classesQuery = classesQuery.eq('series_id', selectedSeries);
    } else if (selectedSegment !== 'all') {
      const seriesIdsInSegment = getSeriesIdsForSegment(series, selectedSegment);
      if (seriesIdsInSegment.length > 0) {
        classesQuery = classesQuery.in('series_id', seriesIdsInSegment);
      } else {
        classesQuery = classesQuery.eq('series_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const [{ data: allStudents, error: studentsError }, { data: allClasses, error: classesError }] =
      await Promise.all([query, classesQuery]);

    if (studentsError) {
      console.error('Erro ao buscar alunos para relatórios:', studentsError);
      return;
    }

    if (classesError) {
      console.error('Erro ao buscar turmas para relatórios:', classesError);
    }

    if (allClasses) {
      const allowedSet =
        allowedUnitIds && allowedUnitIds.length > 0 ? new Set(allowedUnitIds) : null;
      const visibleClassRows = allClasses
        .filter(
          (row) =>
            row.series && (!allowedSet || allowedSet.has(row.unit_id))
        )
        .map((row) => ({
          id: row.id,
          name: row.name,
          unit_id: row.unit_id,
          series_id: row.series_id,
          series: row.series as ReportClassRow['series'],
        }));
      setClassesData(visibleClassRows);
    } else {
      setClassesData([]);
    }

    if (allStudents) {
      const currentAcademicYear = getCurrentAcademicYear();
      const students = allStudents.filter(s => String(s.ano_letivo) === currentAcademicYear);
      const studentsValid = students.filter(s => s.status !== 'cadastro_invalido');
      setStudentsData(students as Student[]);

      const today = getCurrentDate();

      const totalInscricoes = studentsValid.filter(s =>
        s.status !== 'processo_anos_anteriores' && isDateInPeriod(s.created_at)
      ).length;

      const inscritosHoje = studentsValid.filter(s =>
        s.status !== 'processo_anos_anteriores' && getDateYYYYMMDD(s.created_at) === today
      ).length;

      const { count: alunosProximaProva, datesByUnit } = await getNextExamStudentInfoAggregated(
        studentsValid,
        filterByUnit ? selectedUnit : undefined
      );
      setNextExamDatesByUnit(datesByUnit);

      const matriculados = students.filter(
        (s) => s.status === 'matriculado' && isActivityInPeriod(s.created_at, s.updated_at)
      ).length;

      const globalMatriculados = students.filter(s => s.status === 'matriculado').length;

      let totalGoal = 0;
      if (selectedUnit === 'all') {
        const allowedUnitIds = getAllowedUnitIdsForChart() || [];
        if (allowedUnitIds.length > 0) {
          totalGoal = units
            .filter(u => allowedUnitIds.includes(u.id))
            .reduce((acc, u) => acc + (u.student_goal || 0), 0);
        } else {
          totalGoal = units.reduce((acc, u) => acc + (u.student_goal || 0), 0);
        }
      } else {
        const unit = units.find(u => u.id === selectedUnit);
        totalGoal = unit?.student_goal || 0;
      }

      // Agendamentos no período selecionado, alinhados ao filtro de unidade/série e ano letivo atual
      let appQuery = supabase.from('appointments').select('*');
      if (dateFilterType === 'default' || dateFilterType === 'today') {
        appQuery = appQuery.eq('appointment_date', today);
      } else if (dateFilterType === '7days') {
        const sevenDaysAgo = new Date(today + 'T00:00:00');
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        appQuery = appQuery.gte('appointment_date', sevenDaysAgo.toISOString().substring(0, 10)).lte('appointment_date', today);
      } else if (dateFilterType === '30days') {
        const thirtyDaysAgo = new Date(today + 'T00:00:00');
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        appQuery = appQuery.gte('appointment_date', thirtyDaysAgo.toISOString().substring(0, 10)).lte('appointment_date', today);
      } else if (dateFilterType === 'custom' && customStartDate && customEndDate) {
        appQuery = appQuery.gte('appointment_date', customStartDate).lte('appointment_date', customEndDate);
      }
      const { data: appointments } = await appQuery;

      const filteredAppointments = (appointments || []).filter(app =>
        students.some(s => s.id === app.student_id)
      );
      const agendamentosHoje = filteredAppointments.length;

      const studentsWithAppointmentsToday = students.filter(s =>
        filteredAppointments.some(app => app.student_id === s.id)
      );
      setTodayAppointmentsStudents(studentsWithAppointmentsToday as Student[]);

      // Count by status
      const statusCounts: { [key: string]: number } = {};
      studentsValid.forEach(student => {
        if (isActivityInPeriod(student.created_at, student.updated_at)) {
          statusCounts[student.status] = (statusCounts[student.status] || 0) + 1;
        }
      });

      setReportData({
        totalInscricoes,
        inscritosHoje,
        alunosProximaProva,
        agendamentosHoje,
        matriculados,
        globalMatriculados,
        totalGoal,
        statusCounts
      });
    }
  };

  const getFilteredStudents = (filterType: string) => {
    switch (filterType) {
      case 'total':
        return studentsData.filter(s => s.status !== 'cadastro_invalido' && isDateInPeriod(s.created_at));
      case 'inscritos_hoje':
        const todayStr = getCurrentDate();
        return studentsData.filter(s => s.status !== 'cadastro_invalido' && getDateYYYYMMDD(s.created_at) === todayStr);
      case 'proxima_prova':
        return filterStudentsProximaProva(studentsData, nextExamDatesByUnit);
      case 'matriculados':
        return studentsData.filter(
          (s) =>
            s.status === 'matriculado' && isActivityInPeriod(s.created_at, s.updated_at)
        );
      default:
        return [];
    }
  };

  const getStudentsByStatus = (status: string) => {
    return studentsData.filter(
      (s) => s.status === status && isActivityInPeriod(s.created_at, s.updated_at)
    );
  };

  const getStudentsByClassAndStatus = (classId: string, status: string) => {
    return studentsData.filter((s) => s.class_id === classId && s.status === status);
  };

  const unitNames = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.name])),
    [units]
  );

  // Extraído para fora do componente principal para evitar recriação
  const StudentsTable = ({ students, statusLabels }: { students: Student[], statusLabels: { [key: string]: string } }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome do Aluno</TableHead>
          <TableHead>Responsável</TableHead>
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
            <TableCell>{student.responsible_name}</TableCell>
            <TableCell>{student.phone}</TableCell>
            <TableCell>{student.classes.name}</TableCell>
            <TableCell>{student.classes.units.name}</TableCell>
            <TableCell>{statusLabels[student.status] || student.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const statusLabels: { [key: string]: string } = {
    'nao_confirmado': 'Não Confirmado',
    'confirmado': 'Confirmado',
    'cadastro_invalido': 'Cadastro Inválido',
    'nenhum_agendamento': 'Nenhum Agendamento',
    'atendimento_agendado': 'Atendimento Agendado',
    'atendimento_recentemente': 'Atendimento Recente',
    'atendimento_ha_mais_de_uma_semana': 'Atendimento há mais de uma semana',
    'faltou_ao_atendimento': 'Faltou ao Atendimento',
    'ausente': 'Ausente',
    'desistente': 'Desistente',
    'matriculado': 'Matriculado'
  };

  const getStatusCardStyle = (status: string) => {
    const styles: Record<string, { card: string; count: string; label: string }> = {
      nao_confirmado: { card: 'border-slate-200 bg-slate-50', count: 'text-slate-400', label: 'text-slate-500' },
      confirmado: { card: 'border-slate-200 bg-slate-50', count: 'text-slate-500', label: 'text-slate-600' },
      ausente: { card: 'border-red-100 bg-red-50/60', count: 'text-red-400', label: 'text-red-500' },
      nenhum_agendamento: { card: 'border-slate-200 bg-slate-50', count: 'text-slate-300', label: 'text-slate-400' },
      atendimento_agendado: { card: 'border-slate-200 bg-slate-100/80', count: 'text-slate-500', label: 'text-slate-600' },
      faltou_ao_atendimento: { card: 'border-violet-100 bg-violet-50/60', count: 'text-violet-400', label: 'text-violet-500' },
      atendimento_recentemente: { card: 'border-blue-100 bg-blue-50', count: 'text-[#1437cc]', label: 'text-[#1437cc]' },
      atendimento_ha_mais_de_uma_semana: { card: 'border-orange-100 bg-orange-50', count: 'text-orange-500', label: 'text-orange-600' },
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

  const goalPct =
    reportData.totalGoal > 0
      ? Math.min((reportData.globalMatriculados / reportData.totalGoal) * 100, 100)
      : 0;
  const goalRingRadius = 16;
  const goalRingCirc = 2 * Math.PI * goalRingRadius;
  const goalRingOffset = goalRingCirc - (goalPct / 100) * goalRingCirc;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Painel Operacional</h2>
            <p className="text-sm text-muted-foreground">Visão geral das inscrições e status dos alunos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 shadow-sm">
          <svg className="h-10 w-10 shrink-0" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r={goalRingRadius} fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-200" />
            <circle
              cx="20"
              cy="20"
              r={goalRingRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={goalRingCirc}
              strokeDashoffset={goalRingOffset}
              strokeLinecap="round"
              className="text-primary"
              transform="rotate(-90 20 20)"
            />
          </svg>
          <div>
            <p className="text-lg font-bold tabular-nums leading-none text-primary">
              {reportData.globalMatriculados}/{reportData.totalGoal}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meta Anual</p>
          </div>
        </div>
      </div>

      {/* Filters */}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="h-full cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDialog(getFilteredStudents('total'), 'Total de Inscrições')}>
          <Card className="relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
            <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Inscrições</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums text-gray-900">{reportData.totalInscricoes}</div>
            </CardContent>
          </Card>
        </div>

        <div className="h-full cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDialog(getFilteredStudents('inscritos_hoje'), 'Inscritos Hoje')}>
          <Card className="relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
            <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inscritos Hoje</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <UserPlus className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums text-gray-900">{reportData.inscritosHoje}</div>
            </CardContent>
          </Card>
        </div>

        <div className="h-full cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDialog(getFilteredStudents('proxima_prova'), 'Alunos com Próxima Prova')}>
          <Card className="relative h-full overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
            <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Próxima Prova</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <ClipboardList className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums text-gray-900">{reportData.alunosProximaProva}</div>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Matriculados</CardTitle>
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

      {/* Goal Card */}
      <div className="grid grid-cols-1">
        <Card className="relative overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
          <div className="absolute left-0 top-0 h-full w-1.5 bg-primary" />
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Target className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium text-gray-700">
              Progresso da Meta Anual de Novas Matrículas (Total Matriculados vs Meta)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-primary">{reportData.globalMatriculados}</span>
                <span className="text-xl font-medium text-muted-foreground">/ {reportData.totalGoal}</span>
              </div>
              {reportData.totalGoal > 0 && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-primary">
                  {goalPct.toFixed(1).replace('.', ',')}%
                </span>
              )}
            </div>
            {reportData.totalGoal > 0 && (
              <>
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>Meta: {reportData.totalGoal} matrículas</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card className="border-0 shadow-sm ring-1 ring-gray-100">
        <CardHeader>
          <CardTitle className="text-primary">Alunos por Status</CardTitle>
          <CardDescription>Distribuição detalhada dos status dos alunos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {(() => {
              const statusOrder = [
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
              ];
              return statusOrder
                .filter(status => reportData.statusCounts[status] !== undefined)
                .map(status => {
                  const style = getStatusCardStyle(status);
                  return (
                  <div
                    key={status}
                    className={cn(
                      'cursor-pointer rounded-lg border p-4 text-center transition-shadow hover:shadow-md',
                      style.card
                    )}
                    onClick={() => openDialog(getStudentsByStatus(status), `Alunos com Status: ${statusLabels[status] || status}`)}>
                    <div className={cn('text-2xl font-bold tabular-nums', style.count)}>{reportData.statusCounts[status]}</div>
                    <div className={cn('mt-1 text-xs font-semibold leading-snug', style.label)}>{statusLabels[status] || status}</div>
                  </div>
                );})
            })()}
          </div>
        </CardContent>
      </Card>

      <StatusFunnelChart
        statusCounts={reportData.statusCounts}
        statusLabels={statusLabels}
        students={studentsData
          .filter((s) => !isExcludedFromClassChart(s.status))
          .map((s) => ({ class_id: s.class_id, status: s.status }))}
        classes={classesData}
        unitNames={unitNames}
        selectedUnit={selectedUnit}
        selectedSegment={selectedSegment}
        selectedSeries={selectedSeries}
        onUnitChange={setSelectedUnit}
        onSegmentChange={handleSegmentChange}
        onSeriesChange={setSelectedSeries}
        visibleUnits={visibleUnits}
        availableSegments={availableSegments}
        filteredSeriesOptions={filteredSeriesOptions}
        onStatusClick={(status, label) =>
          openDialog(getStudentsByStatus(status), `Alunos com status: ${label}`)
        }
        onClassStatusClick={(classId, status, statusLabel, classLabel) =>
          openDialog(
            getStudentsByClassAndStatus(classId, status),
            `${classLabel} · ${statusLabel}`
          )
        }
      />

      {/* Único Dialog global para exibir a tabela de alunos */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <StudentsTable students={dialogStudents} statusLabels={statusLabels} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
