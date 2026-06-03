
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Calendar, BookOpen, GraduationCap } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { getCurrentDate } from '@/utils/dateUtils';
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

  const getDateYYYYMMDD = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return dateStr.substring(0, 10);
  };

  const isDateInPeriod = (dateStr: string | null | undefined) => {
    const yyyymmdd = getDateYYYYMMDD(dateStr);
    if (!yyyymmdd) return false;

    const todayStr = getCurrentDate();

    if (dateFilterType === 'default' || dateFilterType === 'all') return true;
    if (dateFilterType === 'today') return yyyymmdd === todayStr;
    
    const today = new Date(todayStr + 'T00:00:00');
    const targetDate = new Date(yyyymmdd + 'T00:00:00');

    if (dateFilterType === '7days') {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      return targetDate >= sevenDaysAgo && targetDate <= today;
    }
    if (dateFilterType === '30days') {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return targetDate >= thirtyDaysAgo && targetDate <= today;
    }
    if (dateFilterType === 'custom') {
      if (customStartDate && customEndDate) {
        return yyyymmdd >= customStartDate && yyyymmdd <= customEndDate;
      }
      return true; // não filtra até preencher ambas
    }
    return true;
  };

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
      // Determinar conjunto de unidades de interesse
      const unitIds = unitId
        ? [unitId]
        : Array.from(new Set(students.map((s) => s.unit_id ?? s.classes?.unit_id).filter(Boolean) as string[]));

      if (unitIds.length === 0) {
        return { count: 0, datesByUnit: {} };
      }

      // Buscar todas as datas de prova futuras para as unidades de interesse
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

      // Agrupar e pegar a primeira (mais próxima futura) por unidade
      const earliestByUnit: Record<string, string> = {};
      (upcomingDates || []).forEach((row) => {
        if (!earliestByUnit[row.unit_id]) {
          earliestByUnit[row.unit_id] = row.exam_date as string;
        }
      });

      // Contar alunos pela data de exame: exam_date deve coincidir com a próxima da sua unidade
      const count = students.filter((student) => {
        const studentUnitId = student.unit_id ?? student.classes?.unit_id;
        const unitNextDate = studentUnitId ? earliestByUnit[studentUnitId] : undefined;
        return !!unitNextDate && student.exam_date === unitNextDate;
      }).length;

      return { count, datesByUnit: earliestByUnit };
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
      
      const matriculados = students.filter(s => s.status === 'matriculado' && isDateInPeriod(s.updated_at || s.created_at)).length;

      // Agendamentos no período selecionado, alinhados ao filtro de unidade/série e ano letivo atual
      let appQuery = supabase.from('appointments').select('*');
      if (dateFilterType === 'default' || dateFilterType === 'today') {
        appQuery = appQuery.eq('appointment_date', today);
      } else if (dateFilterType === '7days') {
        const sevenDaysAgo = new Date(today + 'T00:00:00');
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        appQuery = appQuery.gte('appointment_date', sevenDaysAgo.toISOString().substring(0,10)).lte('appointment_date', today);
      } else if (dateFilterType === '30days') {
        const thirtyDaysAgo = new Date(today + 'T00:00:00');
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        appQuery = appQuery.gte('appointment_date', thirtyDaysAgo.toISOString().substring(0,10)).lte('appointment_date', today);
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
        if (isDateInPeriod(student.updated_at || student.created_at)) {
          statusCounts[student.status] = (statusCounts[student.status] || 0) + 1;
        }
      });

      setReportData({
        totalInscricoes,
        inscritosHoje,
        alunosProximaProva,
        agendamentosHoje,
        matriculados,
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
        // Alinhar com a próxima prova por unidade (quando "Todas as unidades"),
        // ou apenas daquela unidade quando um filtro específico estiver selecionado
        if (Object.keys(nextExamDatesByUnit).length > 0) {
          return studentsData.filter((s) => {
            const studentUnitId = s.unit_id ?? s.classes?.unit_id;
            return (
              !!studentUnitId &&
              !!nextExamDatesByUnit[studentUnitId] &&
              s.exam_date === nextExamDatesByUnit[studentUnitId] &&
              s.status !== 'cadastro_invalido'
            );
          });
        }
        // Fallback: quando ainda não há mapeamento de próxima prova por unidade,
        // exibir alunos que possuem alguma data de exame definida
        return studentsData.filter((s) => !!s.exam_date && s.status !== 'cadastro_invalido');
      case 'matriculados':
        return studentsData.filter(s => s.status === 'matriculado' && isDateInPeriod(s.updated_at || s.created_at));
      default:
        return [];
    }
  };

  const getStudentsByStatus = (status: string) => {
    return studentsData.filter(s => s.status === status && isDateInPeriod(s.updated_at || s.created_at));
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Relatórios Gerais</h2>
        <p className="text-gray-600">Visão geral das inscrições e status dos alunos</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedUnit} onValueChange={setSelectedUnit}>
          <SelectTrigger className="w-48">
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
          <SelectTrigger className="w-52">
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
          <SelectTrigger className="w-48">
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
          <SelectTrigger className="w-48">
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
              className="flex h-10 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-sm text-gray-500">até</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="flex h-10 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(getFilteredStudents('total'), 'Total de Inscrições')}>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Inscrições</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalInscricoes}</div>
            </CardContent>
          </Card>
        </div>

        <div className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(getFilteredStudents('inscritos_hoje'), 'Inscritos Hoje')}>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inscritos Hoje</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.inscritosHoje}</div>
            </CardContent>
          </Card>
        </div>

        <div className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(getFilteredStudents('proxima_prova'), 'Alunos com Próxima Prova')}>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próxima Prova</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.alunosProximaProva}</div>
            </CardContent>
          </Card>
        </div>

        <div className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(todayAppointmentsStudents, getAgendamentosLabel())}>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{getAgendamentosLabel()}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.agendamentosHoje}</div>                
            </CardContent>
          </Card>
        </div>

        <div className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(getFilteredStudents('matriculados'), 'Alunos Matriculados')}>
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matriculados</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.matriculados}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Alunos por Status</CardTitle>
          <CardDescription>Distribuição detalhada dos status dos alunos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
            .map(status => (
              <div
                key={status}
                className="text-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openDialog(getStudentsByStatus(status), `Alunos com Status: ${statusLabels[status] || status}`)}>
                <div className="text-lg font-semibold text-gray-900">{reportData.statusCounts[status]}</div>
                <div className="text-xs text-gray-600">{statusLabels[status] || status}</div>
              </div>
            ));
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
