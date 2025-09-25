import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, AlertCircle, CheckCircle, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

interface ImportData {
  student_name: string;
  responsible_name: string;
  email: string;
  phone: string;
  birth_date: string;
  status: string;
  tag: string;
  ano_letivo: string;
  unidade: string;
  turma: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface MappedData extends ImportData {
  unit_id?: string;
  class_id?: string;
  errors?: string[];
}

export const StudentImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportData[]>([]);
  const [mappedData, setMappedData] = useState<MappedData[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [classes, setClasses] = useState<(Tables<'classes'> & { units: Tables<'units'> })[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campos obrigatórios
  const requiredFields = [
    'student_name',
    'responsible_name', 
    'email',
    'phone',
    'birth_date',
    'status',
    'tag',
    'ano_letivo',
    'unidade',
    'turma'
  ];

  // Status válidos
  const validStatuses = [
    'inscrito',
    'confirmado',
    'nao_confirmado',
    'matriculado',
    'desistente',
    'ausente',
    'atendimento_ha_mais_de_uma_semana'
  ];

  const loadReferenceData = async () => {
    try {
      // Carregar unidades
      const { data: unitsData } = await supabase.from('units').select('*');
      setUnits(unitsData || []);

      // Carregar turmas com unidades
      const { data: classesData } = await supabase
        .from('classes')
        .select(`
          *,
          units(*)
        `);
      setClasses(classesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados de referência:', error);
      toast.error('Erro ao carregar dados de referência');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.match(/\.(xlsx|xls)$/)) {
      toast.error('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setFile(uploadedFile);
    parseExcelFile(uploadedFile);
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast.error('A planilha deve ter pelo menos um cabeçalho e uma linha de dados');
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        // Verificar se todos os campos obrigatórios estão presentes
        const missingFields = requiredFields.filter(field => 
          !headers.some(header => header?.toLowerCase().trim() === field)
        );

        if (missingFields.length > 0) {
          toast.error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
          return;
        }

        // Converter dados para o formato esperado
        const parsedData: ImportData[] = rows.map((row, index) => {
          const rowData: any = {};
          headers.forEach((header, colIndex) => {
            const fieldName = header?.toLowerCase().trim();
            if (requiredFields.includes(fieldName)) {
              rowData[fieldName] = row[colIndex] || '';
            }
          });
          return rowData as ImportData;
        }).filter(row => row.student_name); // Filtrar linhas vazias

        setImportData(parsedData);
        toast.success(`${parsedData.length} registros carregados da planilha`);
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast.error('Erro ao processar o arquivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateAndMapData = async () => {
    if (importData.length === 0) {
      toast.error('Nenhum dado para validar');
      return;
    }

    setIsValidating(true);
    setValidationErrors([]);

    try {
      await loadReferenceData();
      
      const errors: ValidationError[] = [];
      const mapped: MappedData[] = [];

      for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        const rowErrors: string[] = [];
        const rowNumber = i + 2; // +2 porque a planilha começa na linha 1 e pula o cabeçalho

        // Validar campos obrigatórios
        requiredFields.forEach(field => {
          if (!row[field as keyof ImportData] || String(row[field as keyof ImportData]).trim() === '') {
            errors.push({
              row: rowNumber,
              field,
              message: `${field} é obrigatório`
            });
            rowErrors.push(`${field} é obrigatório`);
          }
        });

        // Validar email
        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          errors.push({
            row: rowNumber,
            field: 'email',
            message: 'Email inválido'
          });
          rowErrors.push('Email inválido');
        }

        // Validar status
        if (row.status && !validStatuses.includes(row.status)) {
          errors.push({
            row: rowNumber,
            field: 'status',
            message: `Status inválido. Valores aceitos: ${validStatuses.join(', ')}`
          });
          rowErrors.push(`Status inválido: ${row.status}`);
        }

        // Validar data de nascimento
        if (row.birth_date) {
          const birthDate = new Date(row.birth_date);
          if (isNaN(birthDate.getTime())) {
            errors.push({
              row: rowNumber,
              field: 'birth_date',
              message: 'Data de nascimento inválida'
            });
            rowErrors.push('Data de nascimento inválida');
          }
        }

        // Mapear unidade
        const unit = units.find(u => u.name.toLowerCase().trim() === row.unidade.toLowerCase().trim());
        if (!unit) {
          errors.push({
            row: rowNumber,
            field: 'unidade',
            message: `Unidade "${row.unidade}" não encontrada`
          });
          rowErrors.push(`Unidade "${row.unidade}" não encontrada`);
        }

        // Mapear turma
        const classItem = classes.find(c => 
          c.name.toLowerCase().trim() === row.turma.toLowerCase().trim() &&
          c.unit_id === unit?.id
        );
        if (!classItem) {
          errors.push({
            row: rowNumber,
            field: 'turma',
            message: `Turma "${row.turma}" não encontrada na unidade "${row.unidade}"`
          });
          rowErrors.push(`Turma "${row.turma}" não encontrada na unidade "${row.unidade}"`);
        }

        mapped.push({
          ...row,
          unit_id: unit?.id,
          class_id: classItem?.id,
          errors: rowErrors
        });
      }

      setMappedData(mapped);
      setValidationErrors(errors);
      setShowPreview(true);

      if (errors.length === 0) {
        toast.success('Validação concluída com sucesso! Todos os dados estão corretos.');
      } else {
        toast.warning(`Validação concluída com ${errors.length} erro(s) encontrado(s).`);
      }
    } catch (error) {
      console.error('Erro na validação:', error);
      toast.error('Erro durante a validação dos dados');
    } finally {
      setIsValidating(false);
    }
  };

  const executeImport = async () => {
    if (validationErrors.length > 0) {
      toast.error('Corrija os erros antes de importar');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const validData = mappedData.filter(item => !item.errors || item.errors.length === 0);
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < validData.length; i++) {
        const item = validData[i];
        
        try {
          const { error } = await supabase
            .from('students')
            .insert({
              student_name: item.student_name,
              responsible_name: item.responsible_name,
              email: item.email,
              phone: item.phone,
              birth_date: item.birth_date,
              status: item.status as any,
              tag: item.tag,
              ano_letivo: item.ano_letivo,
              unit_id: item.unit_id,
              class_id: item.class_id
            });

          if (error) {
            console.error(`Erro ao inserir aluno ${item.student_name}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Erro ao inserir aluno ${item.student_name}:`, error);
          errorCount++;
        }

        setImportProgress(((i + 1) / validData.length) * 100);
      }

      if (successCount > 0) {
        toast.success(`${successCount} aluno(s) importado(s) com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} aluno(s) falharam na importação`);
      }

      // Limpar dados após importação
      setImportData([]);
      setMappedData([]);
      setValidationErrors([]);
      setShowPreview(false);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Erro durante a importação:', error);
      toast.error('Erro durante a importação');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        student_name: 'João Silva',
        responsible_name: 'Maria Silva',
        email: 'joao@email.com',
        phone: '(11) 99999-9999',
        birth_date: '2010-05-15',
        status: 'inscrito',
        tag: 'VIP',
        ano_letivo: '2026',
        unidade: 'Unidade Centro',
        turma: '6º Ano A'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, 'template_importacao_alunos.xlsx');
  };

  const resetImport = () => {
    setImportData([]);
    setMappedData([]);
    setValidationErrors([]);
    setShowPreview(false);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importação de Alunos em Massa
          </CardTitle>
          <CardDescription>
            Importe alunos através de planilha Excel com todos os dados necessários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Download do template */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
            <div>
              <h4 className="font-medium">Template de Importação</h4>
              <p className="text-sm text-gray-600">
                Baixe o template com o formato correto das colunas
              </p>
            </div>
            <Button onClick={downloadTemplate} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Baixar Template
            </Button>
          </div>

          {/* Upload do arquivo */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Arquivo Excel (.xlsx ou .xls)</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              ref={fileInputRef}
            />
          </div>

          {/* Campos obrigatórios */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Campos obrigatórios:</strong> {requiredFields.join(', ')}
            </AlertDescription>
          </Alert>

          {/* Ações */}
          <div className="flex gap-2">
            <Button 
              onClick={validateAndMapData} 
              disabled={importData.length === 0 || isValidating}
            >
              {isValidating ? 'Validando...' : 'Validar Dados'}
            </Button>
            <Button onClick={resetImport} variant="outline">
              Limpar
            </Button>
          </div>

          {/* Progresso da importação */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importando alunos...</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview dos dados */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Dados</CardTitle>
            <CardDescription>
              {validationErrors.length === 0 
                ? 'Todos os dados estão válidos e prontos para importação'
                : `${validationErrors.length} erro(s) encontrado(s)`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold">{mappedData.length}</div>
                <div className="text-sm text-gray-600">Total de Registros</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {mappedData.filter(item => !item.errors || item.errors.length === 0).length}
                </div>
                <div className="text-sm text-gray-600">Válidos</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">{validationErrors.length}</div>
                <div className="text-sm text-gray-600">Com Erros</div>
              </div>
            </div>

            {/* Tabela de preview */}
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Validação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 2}</TableCell>
                      <TableCell>{item.student_name}</TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell>{item.turma}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.errors && item.errors.length > 0 ? (
                          <div className="flex items-center gap-1 text-red-600">
                            <X className="h-4 w-4" />
                            <span className="text-xs">{item.errors.length} erro(s)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">OK</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Erros detalhados */}
            {validationErrors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Erros Encontrados:</h4>
                <div className="max-h-48 overflow-auto space-y-1">
                  {validationErrors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 p-2 bg-red-50 rounded">
                      <strong>Linha {error.row}:</strong> {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botão de importação */}
            {validationErrors.length === 0 && (
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={executeImport} 
                  disabled={isImporting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isImporting ? 'Importando...' : 'Importar Alunos'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
