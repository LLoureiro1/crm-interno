
import { useEffect, useState } from 'react';
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

type Unit = Tables<'units'>;
type Series = Tables<'series'>;
type Student = Tables<'students'> & {
  classes: {
    name: string;
    unit_id: string;
    units: { id: string; name: string };
  };
};

interface ReportData {
  totalInscricoes: number;
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
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [isCentralUser, setIsCentralUser] = useState(false);

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
    alunosProximaProva: 0,
    agendamentosHoje: 0,
    matriculados: 0,
    statusCounts: {}
  });
  const [studentsData, setStudentsData] = useState<Student[]>([]);
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
  }, [selectedUnit, selectedSeries]);

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    if (data) setUnits(data);
  };

  const fetchSeries = async () => {
    const { data } = await supabase.from('series').select('*');
    if (data) setSeries(data);
  };

  const visibleUnits = units.filter(unit => {
    if (!profile?.unit_id) return true;
    if (isCentralUser) return true;
    return unit.id === profile.unit_id;
  });

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
        : Array.from(new Set(students.map((s) => s.classes.unit_id)));

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
        const unitNextDate = earliestByUnit[student.classes.unit_id];
        return !!unitNextDate && student.exam_date === unitNextDate;
      }).length;

      return { count, datesByUnit: earliestByUnit };
    } catch (error) {
      console.error('Erro ao agregar alunos por próxima prova de unidade:', error);
      return { count: 0, datesByUnit: {} };
    }
  };

  const fetchReportData = async () => {
    let query = supabase.from('students').select(`
      *,
      classes!inner(
        name,
        unit_id,
        units!inner(id, name)
      )
    `);

    const shouldFilterByUnit = !isCentralUser && selectedUnit !== 'all';

    if (shouldFilterByUnit) {
      query = query.eq('classes.unit_id', selectedUnit);
    }

    if (selectedSeries !== 'all') {
      query = query.eq('classes.series_id', selectedSeries);
    }

    const { data: allStudents } = await query;

    if (allStudents) {
      const currentAcademicYear = getCurrentAcademicYear();
      const students = allStudents.filter(s => String(s.ano_letivo) === currentAcademicYear);
      const studentsValid = students.filter(s => s.status !== 'cadastro_invalido');
      setStudentsData(students as Student[]);
      
      const today = getCurrentDate();
      
      const totalInscricoes = studentsValid.filter(s => 
        s.status !== 'processo_anos_anteriores'
      ).length;
      const { count: alunosProximaProva, datesByUnit } = await getNextExamStudentInfoAggregated(
        studentsValid,
        shouldFilterByUnit ? selectedUnit : undefined
      );
      setNextExamDatesByUnit(datesByUnit);
      const matriculados = students.filter(s => s.status === 'matriculado').length;

      // Agendamentos hoje, alinhados ao filtro de unidade/série e ano letivo atual
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', today);

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
      students.forEach(student => {
        statusCounts[student.status] = (statusCounts[student.status] || 0) + 1;
      });

      setReportData({
        totalInscricoes,
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
        return studentsData.filter(s => s.status !== 'cadastro_invalido');
      case 'proxima_prova':
        // Alinhar com a próxima prova por unidade (quando "Todas as unidades"),
        // ou apenas daquela unidade quando um filtro específico estiver selecionado
        if (Object.keys(nextExamDatesByUnit).length > 0) {
          return studentsData.filter((s) =>
            !!nextExamDatesByUnit[s.classes.unit_id] &&
            s.exam_date === nextExamDatesByUnit[s.classes.unit_id] &&
            s.status !== 'cadastro_invalido'
          );
        }
        // Fallback: quando ainda não há mapeamento de próxima prova por unidade,
        // exibir alunos que possuem alguma data de exame definida
        return studentsData.filter((s) => !!s.exam_date && s.status !== 'cadastro_invalido');
      case 'matriculados':
        return studentsData.filter(s => s.status === 'matriculado');
      default:
        return [];
    }
  };

  const getStudentsByStatus = (status: string) => {
    return studentsData.filter(s => s.status === status);
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Relatórios Gerais</h2>
        <p className="text-gray-600">Visão geral das inscrições e status dos alunos</p>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
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

        <Select value={selectedSeries} onValueChange={setSelectedSeries}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Selecione a série" />
          </SelectTrigger>
          <SelectContent side="bottom">
            <SelectItem value="all">Todas as séries</SelectItem>
            {series.map(serie => (
              <SelectItem key={serie.id} value={serie.id}>{serie.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(getFilteredStudents('total'), 'Total de Inscrições')}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Inscrições</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalInscricoes}</div>
            </CardContent>
          </Card>
        </div>

        <div className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(getFilteredStudents('proxima_prova'), 'Alunos com Próxima Prova')}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próxima Prova</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.alunosProximaProva}</div>
            </CardContent>
          </Card>
        </div>

        <div className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(todayAppointmentsStudents, 'Alunos com Agendamentos Hoje')}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.agendamentosHoje}</div>                
            </CardContent>
          </Card>
        </div>

        <div className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDialog(getFilteredStudents('matriculados'), 'Alunos Matriculados')}>
          <Card>
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
              // Definir a ordem específica dos status
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
                'matriculado'
              ];

              // Filtrar apenas os status que existem nos dados e ordenar conforme a ordem definida
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
