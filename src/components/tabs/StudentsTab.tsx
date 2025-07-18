
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Eye, Calendar, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentDialog } from '@/components/StudentDialog';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'> & {
  classes: Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  };
};

type ExamDate = Tables<'exam_dates'> & {
  units: Tables<'units'>;
};

export const StudentsTab = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [examDates, setExamDates] = useState<ExamDate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [seriesFilter, setSeriesFilter] = useState('all');
  const [examDateFilter, setExamDateFilter] = useState('all');
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchUnits();
    fetchSeries();
    fetchExamDates();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, statusFilter, unitFilter, seriesFilter, examDateFilter]);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        classes!inner(
          *,
          units(*),
          series(*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching students:', error);
      return;
    }

    setStudents(data || []);
  };

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*');
    if (data) setUnits(data);
  };

  const fetchSeries = async () => {
    const { data } = await supabase.from('series').select('*');
    if (data) setSeries(data);
  };

  const fetchExamDates = async () => {
    const { data } = await supabase
      .from('exam_dates')
      .select(`
        *,
        units(*)
      `)
      .order('exam_date', { ascending: true });
    
    if (data) setExamDates(data);
  };

  const filterStudents = () => {
    let filtered = students;

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(student => student.status === statusFilter);
    }

    if (unitFilter !== 'all') {
      filtered = filtered.filter(student =>
        student.unit_id === unitFilter || student.classes.unit_id === unitFilter
      );
    }

    if (seriesFilter !== 'all') {
      filtered = filtered.filter(student => student.classes.series_id === seriesFilter);
    }

    if (examDateFilter !== 'all') {
      const today = new Date().toISOString().split('T')[0];
      
      switch (examDateFilter) {
        case 'sem_data':
          filtered = filtered.filter(student => !student.exam_date);
          break;
        case 'hoje':
          filtered = filtered.filter(student => student.exam_date === today);
          break;
        case 'futuras':
          filtered = filtered.filter(student => student.exam_date && student.exam_date > today);
          break;
        case 'passadas':
          filtered = filtered.filter(student => student.exam_date && student.exam_date < today);
          break;
        default:
          if (examDateFilter.startsWith('date_')) {
            const targetDate = examDateFilter.replace('date_', '');
            filtered = filtered.filter(student => student.exam_date === targetDate);
          }
          break;
      }
    }

    setFilteredStudents(filtered);
  };

  const exportToExcel = () => {
    const exportData = filteredStudents.map(student => ({
      'Código': student.code,
      'Nome do Aluno': student.student_name,
      'Nome do Responsável': student.responsible_name,
      'Data de Nascimento': new Date(student.birth_date).toLocaleDateString('pt-BR'),
      'Telefone': student.phone,
      'Email': student.email,
      'Cidade': student.city,
      'Bairro': student.neighborhood,
      'Escola de Origem': student.origin_school,
      'Série': student.classes.series.name,
      'Unidade': student.classes.units.name,
      'Status': student.status,
      'Data da Prova': student.exam_date ? new Date(student.exam_date).toLocaleDateString('pt-BR') : '',
      'Data da Entrevista': student.interview_date ? new Date(student.interview_date).toLocaleDateString('pt-BR') : '',
      'Nota Português': student.portuguese_grade || '',
      'Nota Matemática': student.math_grade || '',
      'Data de Inscrição': new Date(student.created_at).toLocaleDateString('pt-BR'),
      'Percentual de Desconto': student.discount_percentage ? `${student.discount_percentage}%` : '0%'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, `alunos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
      'nao_confirmado': { label: 'Não Confirmado', variant: 'outline' },
      'confirmado': { label: 'Confirmado', variant: 'secondary' },
      'presente': { label: 'Presente', variant: 'default' },
      'matriculado': { label: 'Matriculado', variant: 'default' },
      'desistente': { label: 'Desistente', variant: 'destructive' },
      'nenhum_agendamento': { label: 'Nenhum Agendamento', variant: 'outline' },
      'atendimento_agendado': { label: 'Atendimento Agendado', variant: 'secondary' },
      'faltou_ao_atendimento': { label: 'Faltou ao Atendimento', variant: 'destructive' },
      'atendimento_recentemente': { label: 'Atendimento Recentemente', variant: 'default' }
    };

    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentDialog(true);
  };

  const handleOpenStudentPage = (studentId: string) => {
    navigate(`/student/${studentId}`);
  };

  const handleCloseDialog = () => {
    setShowStudentDialog(false);
    setSelectedStudent(null);
  };

  const handleUpdateStudent = () => {
    fetchStudents();
  };

  // Agrupar datas de prova únicas
  const uniqueExamDates = Array.from(
    new Map(examDates.map(ed => [ed.exam_date, ed])).values()
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Gestão de Alunos</h2>
          <p className="text-gray-600">Visualize e gerencie todos os alunos cadastrados</p>
        </div>
        <Button onClick={exportToExcel} className="bg-orange-500 hover:bg-orange-600">
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="nao_confirmado">Não Confirmado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="presente">Presente</SelectItem>
                <SelectItem value="matriculado">Matriculado</SelectItem>
                <SelectItem value="desistente">Desistente</SelectItem>
                <SelectItem value="nenhum_agendamento">Nenhum Agendamento</SelectItem>
                <SelectItem value="atendimento_agendado">Atendimento Agendado</SelectItem>
                <SelectItem value="faltou_ao_atendimento">Faltou ao Atendimento</SelectItem>
                <SelectItem value="atendimento_recentemente">Atendimento Recentemente</SelectItem>
              </SelectContent>
            </Select>

            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {units.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={seriesFilter} onValueChange={setSeriesFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Série" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as séries</SelectItem>
                {series.map(serie => (
                  <SelectItem key={serie.id} value={serie.id}>{serie.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={examDateFilter} onValueChange={setExamDateFilter}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>Data da Prova</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as datas</SelectItem>
                <SelectItem value="sem_data">Sem data</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="futuras">Futuras</SelectItem>
                <SelectItem value="passadas">Passadas</SelectItem>
                {uniqueExamDates.map(examDate => (
                  <SelectItem key={examDate.id} value={`date_${examDate.exam_date}`}>
                    {new Date(examDate.exam_date).toLocaleDateString('pt-BR')} - {examDate.exam_time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alunos ({filteredStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{student.student_name}</h3>
                      <p className="text-sm text-gray-600">Código: {student.code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{student.classes.series.name}</p>
                      <p className="text-sm text-gray-600">{student.classes.units.name}</p>
                    </div>
                    <div>
                      {student.exam_date && (
                        <p className="text-sm text-gray-600 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Prova: {new Date(student.exam_date).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {student.interview_date && (
                        <p className="text-sm text-blue-600 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Entrevista: {new Date(student.interview_date).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div>
                      {getStatusBadge(student.status)}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewStudent(student)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenStudentPage(student.id)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Página
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Student Dialog */}
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
