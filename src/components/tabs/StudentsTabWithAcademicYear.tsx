import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Eye, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentDialog } from '@/components/StudentDialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { AcademicYearFilter } from '@/components/ui/AcademicYearFilter';
import type { Tables } from '@/integrations/supabase/types';
import { formatDateForDisplay, formatTimeForDisplay, getCurrentDate } from '@/utils/dateUtils';
import { toast } from 'sonner';

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

export const StudentsTabWithAcademicYear = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [examDates, setExamDates] = useState<ExamDate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [seriesFilter, setSeriesFilter] = useState<string[]>([]);
  const [examDateFilter, setExamDateFilter] = useState<string[]>([]);
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('');
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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
    let filtered = [...students];
  
    // Filtro por ano letivo
    if (academicYearFilter) {
      filtered = filtered.filter(student => student.ano_letivo === academicYearFilter);
    }
  
    // Filtro por termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const digits = searchTerm.replace(/\D/g, '');
      const hasDigits = digits.length >= 3;
  
      filtered = filtered.filter(student => {
        const matchesText =
          student.student_name.toLowerCase().includes(term) ||
          student.responsible_name.toLowerCase().includes(term) ||
          student.email.toLowerCase().includes(term) ||
          (student.phone || '').toLowerCase().includes(term);
  
        const primaryPhoneDigits = (student.phone || '').replace(/\D/g, '');
        const additionalPhonesDigits = (student.student_phones || []).map(p => (p.phone_number || '').replace(/\D/g, ''));
        const matchesPhone = hasDigits && (
          (primaryPhoneDigits.includes(digits)) ||
          additionalPhonesDigits.some(p => p.includes(digits))
        );
  
        return matchesText || matchesPhone;
      });
    }
  
    // Filtro por status
    if (statusFilter.length > 0) {
      filtered = filtered.filter(student => statusFilter.includes(student.status));
    }
  
    // Filtro por unidade
    if (unitFilter.length > 0) {
      filtered = filtered.filter(student => unitFilter.includes(student.classes.unit_id));
    }
  
    // Filtro por série
    if (seriesFilter.length > 0) {
      filtered = filtered.filter(student => seriesFilter.includes(student.classes.series_id));
    }
  
    // Filtro por data de exame
    if (examDateFilter.length > 0) {
      filtered = filtered.filter(student => 
        student.exam_date && examDateFilter.includes(student.exam_date)
      );
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
      'Nome do Aluno': student.student_name,
      'Responsável': student.responsible_name,
      'Email': student.email,
      'Telefone': student.phone,
      'Data de Nascimento': student.birth_date,
      'Cidade': student.city || '',
      'Bairro': student.neighborhood,
      'Escola de Origem': student.origin_school,
      'Status': student.status,
      'Tag': student.tag || '',
      'Ano Letivo': student.ano_letivo || '',
      'Turma': student.classes.name,
      'Série': student.classes.series.name,
      'Unidade': student.classes.units.name,
      'Data da Prova': student.exam_date || '',
      'Nota Português': student.portuguese_grade || '',
      'Nota Matemática': student.math_grade || '',
      'Data de Entrevista': student.interview_date || '',
      'Data de Criação': formatDateForDisplay(student.created_at)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, `alunos_${academicYearFilter || 'todos'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const statusLabels: { [key: string]: string } = {
    'inscrito': 'Inscrito',
    'confirmado': 'Confirmado',
    'nao_confirmado': 'Não Confirmado',
    'matriculado': 'Matriculado',
    'desistente': 'Desistente',
    'ausente': 'Ausente',
    'atendimento_ha_mais_de_uma_semana': 'Atendimento há mais de uma semana'
  };

  const statusColors: { [key: string]: string } = {
    'inscrito': 'bg-blue-100 text-blue-800',
    'confirmado': 'bg-green-100 text-green-800',
    'nao_confirmado': 'bg-yellow-100 text-yellow-800',
    'matriculado': 'bg-purple-100 text-purple-800',
    'desistente': 'bg-red-100 text-red-800',
    'ausente': 'bg-gray-100 text-gray-800',
    'atendimento_ha_mais_de_uma_semana': 'bg-orange-100 text-orange-800'
  };

  // Paginação
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Alunos</h2>
          <p className="text-gray-600">
            {filteredStudents.length} aluno(s) encontrado(s)
            {academicYearFilter && ` no ano letivo ${academicYearFilter}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={fetchStudents} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Filtro de Ano Letivo */}
            <AcademicYearFilter
              value={academicYearFilter}
              onValueChange={setAcademicYearFilter}
            />

            {/* Busca */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Nome, responsável, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Ordenação */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ordem de inscrição</label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'desc' | 'asc')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar ordem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Mais recente primeiro</SelectItem>
                  <SelectItem value="asc">Mais antiga primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <MultiSelect
                options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
                selected={statusFilter}
                onChange={setStatusFilter}
                placeholder="Selecionar status"
              />
            </div>

            {/* Unidade */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Unidade</label>
              <MultiSelect
                options={units.map(unit => ({ value: unit.id, label: unit.name }))}
                selected={unitFilter}
                onChange={setUnitFilter}
                placeholder="Selecionar unidades"
              />
            </div>

            {/* Série */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Série</label>
              <MultiSelect
                options={series.map(serie => ({ value: serie.id, label: serie.name }))}
                selected={seriesFilter}
                onChange={setSeriesFilter}
                placeholder="Selecionar séries"
              />
            </div>

            {/* Data de Exame */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de Exame</label>
              <MultiSelect
                options={examDates.map(exam => ({ 
                  value: exam.exam_date, 
                  label: `${formatDateForDisplay(exam.exam_date)} - ${exam.units.name}` 
                }))}
                selected={examDateFilter}
                onChange={setExamDateFilter}
                placeholder="Selecionar datas"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de alunos */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Ano Letivo</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.student_name}</TableCell>
                    <TableCell>{student.responsible_name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.phone}</TableCell>
                    <TableCell>{student.classes.name}</TableCell>
                    <TableCell>{student.classes.units.name}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[student.status] || 'bg-gray-100 text-gray-800'}>
                        {statusLabels[student.status] || student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {student.tag && (
                        <Badge variant="outline">{student.tag}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.ano_letivo && (
                        <Badge variant="secondary">{student.ano_letivo}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowStudentDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/student/${student.id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Dialog do aluno */}
      {selectedStudent && (
        <StudentDialog
          student={selectedStudent}
          open={showStudentDialog}
          onClose={() => {
            setShowStudentDialog(false);
            setSelectedStudent(null);
          }}
          onUpdate={fetchStudents}
        />
      )}
    </div>
  );
};
