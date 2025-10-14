
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Calendar, BookOpen, GraduationCap } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { getCurrentDate } from '@/utils/dateUtils';
import { Link } from 'react-router-dom';

type Unit = Tables<'units'>;
type Series = Tables<'series'>;
type Student = Tables<'students'> & {
  classes: { 
    name: string;
    units: { name: string };
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
  const [units, setUnits] = useState<Unit[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');

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

  useEffect(() => {
    fetchUnits();
    fetchSeries();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [selectedUnit, selectedSeries]);

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*');
    if (data) setUnits(data);
  };

  const fetchSeries = async () => {
    const { data } = await supabase.from('series').select('*');
    if (data) setSeries(data);
  };

  // Função para contar alunos da próxima prova específica
  const getNextExamStudentCount = async (students: Student[]): Promise<number> => {
    try {
      // Buscar a próxima data de exame (mais próxima do hoje)
      const { data: nextExamDate, error } = await supabase
        .from('exam_dates')
        .select('exam_date')
        .gte('exam_date', getCurrentDate())
        .order('exam_date', { ascending: true })
        .limit(1)
        .single();

      if (error || !nextExamDate) {
        console.log('Nenhuma prova futura encontrada');
        return 0;
      }

      // Contar apenas alunos com exam_date igual à próxima data
      const count = students.filter(student => {
        const isConfirmedStudent = student.status === 'confirmado' || student.status === 'nao_confirmado';
        const hasExamDate = student.exam_date === nextExamDate.exam_date;
        return isConfirmedStudent && hasExamDate;
      }).length;

      return count;
    } catch (error) {
      console.error('Erro ao contar alunos da próxima prova:', error);
      return 0;
    }
  };

  const fetchReportData = async () => {
    let query = supabase.from('students').select(`
      *,
      classes!inner(
        name,
        units!inner(name)
      )
    `);

    if (selectedUnit !== 'all') {
      query = query.eq('classes.unit_id', selectedUnit);
    }

    if (selectedSeries !== 'all') {
      query = query.eq('classes.series_id', selectedSeries);
    }

    const { data: allStudents } = await query;

    if (allStudents) {
      // Filtrar apenas alunos do ano letivo atual
      const currentAcademicYear = getCurrentAcademicYear();
      console.log('🔍 Debug Relatórios:');
      console.log('📅 Data atual:', new Date().toLocaleDateString());
      console.log('📚 Ano letivo calculado:', currentAcademicYear);
      console.log('👥 Total de alunos carregados:', allStudents.length);
      console.log('📊 Anos letivos disponíveis:', [...new Set(allStudents.map(s => s.ano_letivo))]);
      
      const students = allStudents.filter(s => String(s.ano_letivo) === currentAcademicYear);
      console.log('✅ Alunos filtrados para ano letivo atual:', students.length);
      
      setStudentsData(students as Student[]);
      
      const today = getCurrentDate();
      
      const totalInscricoes = students.filter(s => 
        s.status !== 'cadastro_invalido' && 
        s.status !== 'processo_anos_anteriores'
      ).length;
      const alunosProximaProva = await getNextExamStudentCount(students);
      const matriculados = students.filter(s => s.status === 'matriculado').length;

      // Fetch today's appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', today);
      
      const agendamentosHoje = appointments?.length || 0;

      // Fetch students for today's appointments
      if (appointments) {
        const studentIds = appointments.map(app => app.student_id);
        const { data: studentsWithAppointments } = await supabase
          .from('students')
          .select(`
            *,
            classes!inner(
              name,
              units!inner(name)
            )
          `)
          .in('id', studentIds);
        if (studentsWithAppointments) {
          setTodayAppointmentsStudents(studentsWithAppointments as Student[]);
        }
      }

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
        return studentsData;
      case 'proxima_prova':
        return studentsData.filter(s => s.status === 'confirmado' || s.status === 'nao_confirmado');
      case 'matriculados':
        return studentsData.filter(s => s.status === 'matriculado');
      default:
        return [];
    }
  };

  const getStudentsByStatus = (status: string) => {
    return studentsData.filter(s => s.status === status);
  };

  const StudentsList = ({ students, title }: { students: Student[], title: string }) => (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
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
    </DialogContent>
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
            {units.map(unit => (
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
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Inscrições</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalInscricoes}</div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <StudentsList 
            students={getFilteredStudents('total')} 
            title="Total de Inscrições" 
          />
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Próxima Prova</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.alunosProximaProva}</div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <StudentsList 
            students={getFilteredStudents('proxima_prova')} 
            title="Alunos com Próxima Prova" 
          />
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.agendamentosHoje}</div>                
              </CardContent>
            </Card>
          </DialogTrigger>
          <StudentsList students={todayAppointmentsStudents} title="Alunos com Agendamentos Hoje" />
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matriculados</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.matriculados}</div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <StudentsList 
            students={getFilteredStudents('matriculados')} 
            title="Alunos Matriculados" 
          />
        </Dialog>
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
                  <Dialog key={status}>
                    <DialogTrigger asChild>
                      <div className="text-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:shadow-lg transition-shadow">
                        <div className="text-lg font-semibold text-gray-900">{reportData.statusCounts[status]}</div>
                        <div className="text-xs text-gray-600">{statusLabels[status] || status}</div>
                      </div>
                    </DialogTrigger>
                    <StudentsList 
                      students={getStudentsByStatus(status)} 
                      title={`Alunos com Status: ${statusLabels[status] || status}`} 
                    />
                  </Dialog>
                ));
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
