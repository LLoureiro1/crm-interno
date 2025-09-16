import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Eye, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentDialog } from '@/components/StudentDialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import type { Tables } from '@/integrations/supabase/types';
import { formatDateForDisplay, formatTimeForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';

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
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [seriesFilter, setSeriesFilter] = useState<string[]>([]);
  const [examDateFilter, setExamDateFilter] = useState<string[]>([]);
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchStudents();
    fetchUnits();
    fetchSeries();
    fetchExamDates();
  }, []);

  useEffect(() => {
    filterStudents();
    setCurrentPage(1); // Reset para primeira página quando filtros mudarem
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

    setStudents((data as Student[]) || []);
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
    
    if (data) setExamDates(data as ExamDate[]);
  };

  const filterStudents = () => {
    let filtered = students;

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter.length > 0) {
      filtered = filtered.filter(student => statusFilter.includes(student.status!));
    }

    if (unitFilter.length > 0) {
      filtered = filtered.filter(student =>
        unitFilter.includes(student.unit_id!) || unitFilter.includes(student.classes.unit_id!)
      );
    }

    if (seriesFilter.length > 0) {
      filtered = filtered.filter(student => seriesFilter.includes(student.classes.series_id!));
    }

    if (examDateFilter.length > 0) {
      const today = new Date().toISOString().split('T')[0];
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

    setFilteredStudents(filtered);
  };

  const exportToExcel = () => {
    const exportData = filteredStudents.map(student => ({
      'Código': student.code,
      'Nome do Aluno': student.student_name,
      'Nome do Responsável': student.responsible_name,
      'Data de Nascimento': student.birth_date ? new Date(student.birth_date).toLocaleDateString('pt-BR') : '',
      'Telefone': student.phone,
      'Email': student.email,
      'Cidade': student.city,
      'Bairro': student.neighborhood,
      'Escola de Origem': student.origin_school,
      'Série': student.classes.series.name,
      'Unidade': student.classes.units.name,
      'Status': student.status,
      'Data da Prova': student.exam_date ? formatDateForDisplay(student.exam_date) : '',
      'Data da Entrevista': student.interview_date ? formatDateForDisplay(student.interview_date) : '',
      'Nota Português': student.portuguese_grade || '',
      'Nota Matemática': student.math_grade || '',
      'Data de Inscrição': student.created_at ? new Date(student.created_at).toLocaleDateString('pt-BR') : '',
      'Percentual de Desconto': student.discount_percentage ? `${student.discount_percentage}%` : '0%'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, `alunos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "purple" | "warning" | "ausente" } } = {
      'nao_confirmado': { label: 'Não Confirmado', variant: 'outline' },
      'confirmado': { label: 'Confirmado', variant: 'secondary' },
      'cadastro_invalido': { label: 'Cadastro Inválido', variant: 'default' },
      'matriculado': { label: 'Matriculado', variant: 'success' },
      'desistente': { label: 'Desistente', variant: 'destructive' },
      'nenhum_agendamento': { label: 'Nenhum Agendamento', variant: 'outline' },
      'atendimento_agendado': { label: 'Atendimento Agendado', variant: 'secondary' },
      'faltou_ao_atendimento': { label: 'Faltou ao Atendimento', variant: 'purple' },
      'atendimento_recentemente': { label: 'Atendimento Recentemente', variant: 'default' },
      'atendimento_ha_mais_de_uma_semana': { label: 'Atendimento há mais de uma semana', variant: 'warning' },
      'ausente': { label: 'Ausente', variant: 'ausente' }
    };

    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleManualStatusUpdate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('update-student-statuses', {
        body: { source: 'manual' }
      });

      if (error) {
        console.error('Error invoking status update:', error);
        toast.error('Erro ao atualizar status dos alunos');
        return;
      }

      toast.success(data.message || 'Status dos alunos atualizados com sucesso');
      fetchStudents(); // Refresh the list
    } catch (error) {
      console.error('Error calling status update function:', error);
      toast.error('Erro ao chamar função de atualização');
    }
  };

  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentDialog(true);
  };

  const handleOpenStudentPage = (studentId: string) => {
    console.log('studentId:', studentId);
    console.log('Navigating to:', `/student/${studentId}`);
    navigate(`/student/${studentId}`);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Gestão de Alunos</h2>
          <p className="text-gray-600">Visualize e gerencie todos os alunos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleManualStatusUpdate} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Status
          </Button>
          <Button onClick={exportToExcel} className="bg-orange-500 hover:bg-orange-600">
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <MultiSelect
              options={[
                { value: 'nao_confirmado', label: 'Não Confirmado' },
                { value: 'confirmado', label: 'Confirmado' },
                { value: 'cadastro_invalido', label: 'Cadastro Inválido' },
                { value: 'matriculado', label: 'Matriculado' },
                { value: 'desistente', label: 'Desistente' },
                { value: 'nenhum_agendamento', label: 'Nenhum Agendamento' },
                { value: 'atendimento_agendado', label: 'Atendimento Agendado' },
                { value: 'faltou_ao_atendimento', label: 'Faltou ao Atendimento' },
                { value: 'atendimento_recentemente', label: 'Atendimento Recentemente' },
                { value: 'atendimento_ha_mais_de_uma_semana', label: 'Atendimento há mais de uma semana' },
                { value: 'ausente', label: 'Ausente' }
              ]}
              selected={statusFilter}
              onChange={setStatusFilter}
              placeholder="Status"
              className="w-full"
            />

            <MultiSelect
              options={units.map(unit => ({ value: unit.id, label: unit.name }))}
              selected={unitFilter}
              onChange={setUnitFilter}
              placeholder="Unidade"
              className="w-full"
            />

            <MultiSelect
              options={series.map(_series => ({ value: _series.id, label: _series.name }))}
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Alunos ({filteredStudents.length})
            {totalPages > 1 && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                - Página {currentPage} de {totalPages} 
                ({startIndex + 1}-{Math.min(endIndex, filteredStudents.length)} de {filteredStudents.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentStudents.map((student) => {
              return (
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
                            Prova: {formatDateForDisplay(student.exam_date)}
                          </p>
                        )}
                        {student.interview_date && (
                          <p className="text-sm text-blue-600 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            Entrevista: {formatDateForDisplay(student.interview_date)} 
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
                      Gerenciar Aluno
                    </Button>
                  </div>
                </div>
              );
            })}
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
