import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Eye, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentDialog } from '@/components/StudentDialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import type { Tables } from '@/integrations/supabase/types';
import { formatDateForDisplay, formatTimeForDisplay, getCurrentDate } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Student = Tables<'students'> & {
  classes: Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  };
  student_phones?: { phone_number: string }[];
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
  const [academicYearFilter, setAcademicYearFilter] = useState<string[]>([]);
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [availableAcademicYears, setAvailableAcademicYears] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

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

  useEffect(() => {
    fetchStudents();
    fetchUnits();
    fetchSeries();
    fetchExamDates();
    fetchAvailableAcademicYears();
  }, []);

  useEffect(() => {
    filterStudents();
    setCurrentPage(1); // Reset para primeira página quando filtros mudarem
  }, [students, searchTerm, statusFilter, unitFilter, seriesFilter, examDateFilter, academicYearFilter, sortOrder]);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        classes!inner(
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

    // Definir o ano letivo atual como padrão
    const currentAcademicYear = getCurrentAcademicYear();
    if (years.includes(currentAcademicYear)) {
      setAcademicYearFilter([currentAcademicYear]);
    } else if (years.length > 0) {
      // Se o ano atual não estiver disponível, usar o mais recente
      setAcademicYearFilter([years[0]]);
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
        unitFilter.includes(student.unit_id!) || unitFilter.includes(student.classes.unit_id!)
      );
    }

    if (seriesFilter.length > 0) {
      filtered = filtered.filter(student => seriesFilter.includes(student.classes.series_id!));
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
      'Percentual de Desconto': student.discount_percentage !== null ? `${student.discount_percentage}%` : '-',
      'Ano Letivo': student.ano_letivo || '',
      'Tag': student.tag || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, `alunos_${getCurrentDate()}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "purple" | "warning" | "ausente" | "cadastro_invalido" | "processo_anos_anteriores" } } = {
      'nao_confirmado': { label: 'Não Confirmado', variant: 'outline' },
      'confirmado': { label: 'Confirmado', variant: 'secondary' },
      'cadastro_invalido': { label: 'Cadastro Inválido', variant: 'cadastro_invalido' },
      'matriculado': { label: 'Matriculado', variant: 'success' },
      'desistente': { label: 'Desistente', variant: 'destructive' },
      'nenhum_agendamento': { label: 'Nenhum Agendamento', variant: 'outline' },
      'atendimento_agendado': { label: 'Atendimento Agendado', variant: 'secondary' },
      'faltou_ao_atendimento': { label: 'Faltou ao Atendimento', variant: 'purple' },
      'atendimento_recentemente': { label: 'Atendimento Recentemente', variant: 'default' },
      'atendimento_ha_mais_de_uma_semana': { label: 'Atendimento há mais de uma semana', variant: 'warning' },
      'ausente': { label: 'Ausente', variant: 'ausente' },
      'processo_anos_anteriores': { label: 'Processo Anos Anteriores', variant: 'processo_anos_anteriores' }
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Gestão de Inscritos</h2>
          <p className="text-gray-600">Visualize e gerencie todos os candidatos cadastrados</p>
        </div>
        <div className="flex gap-2">
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
            <div className="md:col-span-1">
              <MultiSelect
                options={availableAcademicYears.map(year => ({
                  value: year,
                  label: `${year}${year === getCurrentAcademicYear() ? ' (Vigente)' : ''}`
                }))}
                selected={academicYearFilter}
                onChange={setAcademicYearFilter}
                placeholder="Ano Letivo"
                className="w-40"
              />
            </div>

            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, código ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Ordem de inscrição (movido para o final) */}
            
            <div className="md:col-span-1">
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
            </div>

            <div className="md:col-span-1">
              <MultiSelect
                options={units.map(unit => ({ value: unit.id, label: unit.name }))}
                selected={unitFilter}
                onChange={setUnitFilter}
                placeholder="Unidade"
                className="w-full"
              />
            </div>

            <div className="md:col-span-1">
              <MultiSelect
                options={series.map(_series => ({ value: _series.id, label: _series.name }))}
                selected={seriesFilter}
                onChange={setSeriesFilter}
                placeholder="Série"
                className="w-full"
              />
            </div>

            <div className="md:col-span-1">
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

            {/* Ordem de inscrição */}
            <div className="md:col-span-1">
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'desc' | 'asc')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Ordem de inscrição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Mais recente primeiro</SelectItem>
                  <SelectItem value="asc">Mais antiga primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Inscritos ({filteredStudents.length})
            {totalPages > 1 && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                - Página {currentPage} de {totalPages}  ({startIndex + 1}-{Math.min(endIndex, filteredStudents.length)} de {filteredStudents.length})
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
                      Ver Resumo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenStudentPage(student.id)}
                      onContextMenu={(e) => handleContextMenu(e, student.id)}
                      title="Clique esquerdo: abrir na mesma aba | Clique direito: abrir em nova aba"
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
