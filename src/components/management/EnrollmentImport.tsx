import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
// Usando tipos explícitos em vez de importar Tables para evitar recursão de tipos
type Student = {
  id: string;
  code: string;
  codigo_erp?: string;
  status: string;
};

interface EnrollmentImportData {
  codigo_crm: string;
  codigo_erp: string;
  status: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface MappedData extends EnrollmentImportData {
  errors?: string[];
  student_id?: string;
}

export const EnrollmentImport = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<EnrollmentImportData[]>([]);
  const [mappedData, setMappedData] = useState<MappedData[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef<boolean>(true);
  
  // Tratamento defensivo para operações do DOM
  useEffect(() => {
    // Marcar componente como montado
    isMounted.current = true;
    
    // Função para capturar erros de DOM globalmente
    const handleDOMError = (event: ErrorEvent) => {
      if (event.message.includes('removeChild') || event.message.includes('Node')) {
        console.warn('Erro de DOM capturado e tratado:', event.message);
        event.preventDefault();
        event.stopPropagation();
      }
    };
    
    // Adicionar listener de erro global
    window.addEventListener('error', handleDOMError);
    
    // Limpeza ao desmontar
    return () => {
      isMounted.current = false;
      window.removeEventListener('error', handleDOMError);
      
      // Limpar referências para evitar erros de DOM
      if (fileInputRef.current) {
        try {
          // Remover listeners de eventos para evitar callbacks após desmontagem
          const clonedInput = fileInputRef.current.cloneNode(true);
          if (fileInputRef.current.parentNode) {
            fileInputRef.current.parentNode.replaceChild(clonedInput, fileInputRef.current);
          }
        } catch (error) {
          console.warn('Erro ao limpar referência de input:', error);
        }
      }
    };
  }, []);
  
  // Função para registrar interação
  const registerInteraction = async (studentId: string, description: string) => {
    try {
      await supabase.from('student_interactions').insert({
        student_id: studentId,
        user_id: user?.id,
        interaction_type: 'matricula',
        comments: description,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao registrar interação:', error);
    }
  };

  // Campos obrigatórios
  const requiredFields = [
    'codigo_crm',
    'codigo_erp',
    'status'
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Verificar se o componente ainda está montado
    if (!isMounted.current) return;
    
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
      // Verificar se o componente ainda está montado
      if (!isMounted.current) return;
      
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast.error('A planilha deve ter pelo menos um cabeçalho e uma linha com dados');
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        console.log('📋 Cabeçalhos encontrados:', headers);

        // Verificar se todos os campos obrigatórios estão presentes
        const missingFields = requiredFields.filter(field => 
          !headers.some(header => header?.toLowerCase().trim() === field)
        );

        if (missingFields.length > 0) {
          toast.error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
          return;
        }

        // Converter dados para o formato esperado
        const parsedData: EnrollmentImportData[] = rows.map((row) => {
          const rowData: any = {};
          headers.forEach((header, colIndex) => {
            const fieldName = header?.toLowerCase().trim();
            if (fieldName && colIndex < row.length) {
              rowData[fieldName] = row[colIndex] !== undefined ? String(row[colIndex]).trim() : '';
            }
          });
          // Preserve zeros à esquerda em codigo_crm padronizando para 6 dígitos
          if (rowData['codigo_crm'] && /^\d{1,6}$/.test(rowData['codigo_crm'])) {
            rowData['codigo_crm'] = rowData['codigo_crm'].padStart(6, '0');
          }
          return rowData as EnrollmentImportData;
        }).filter(row => Object.keys(row).length > 0);

        setImportData(parsedData);
        validateData(parsedData);
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast.error('Erro ao processar o arquivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateData = async (data: EnrollmentImportData[]) => {
    // Verificar se o componente ainda está montado
    if (!isMounted.current) return;
    
    setIsValidating(true);
    setValidationErrors([]);
    
    try {
      const errors: ValidationError[] = [];
      const mappedItems: MappedData[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowErrors: string[] = [];
        const mappedRow: MappedData = { ...row, errors: [] };

        // Validar código CRM (deve ter 6 dígitos)
        if (!row.codigo_crm) {
          errors.push({ row: i, field: 'codigo_crm', message: 'Código CRM é obrigatório' });
          rowErrors.push('Código CRM é obrigatório');
        } else if (!/^\d{6}$/.test(row.codigo_crm)) {
          errors.push({ row: i, field: 'codigo_crm', message: 'Código CRM deve ter 6 dígitos' });
          rowErrors.push('Código CRM deve ter 6 dígitos');
        } else {
          // Verificar se o aluno existe
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('id')
            .eq('code', row.codigo_crm)
            .single() as { data: Student | null, error: any };

          if (studentError || !studentData) {
            errors.push({ row: i, field: 'codigo_crm', message: 'Aluno não encontrado com este código CRM' });
            rowErrors.push('Aluno não encontrado com este código CRM');
          } else {
            mappedRow.student_id = studentData.id;
          }
        }

        // Validar código ERP
        if (!row.codigo_erp) {
          errors.push({ row: i, field: 'codigo_erp', message: 'Código ERP é obrigatório' });
          rowErrors.push('Código ERP é obrigatório');
        }

        // Validar status (deve ser 'matriculado')
        if (row.status !== 'matriculado') {
          errors.push({ row: i, field: 'status', message: 'Status deve ser "matriculado"' });
          rowErrors.push('Status deve ser "matriculado"');
        }

        mappedRow.errors = rowErrors;
        mappedItems.push(mappedRow);
      }

      setValidationErrors(errors);
      setMappedData(mappedItems);
      setShowPreview(true);
      
      if (errors.length === 0) {
        toast.success('Validação concluída com sucesso!');
      } else {
        toast.error(`Encontrados ${errors.length} erros na validação`);
      }
    } catch (error) {
      console.error('Erro na validação:', error);
      toast.error('Erro ao validar os dados');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    // Verificar se o componente ainda está montado
    if (!isMounted.current) return;
    
    if (validationErrors.length > 0) {
      toast.error('Corrija os erros antes de importar');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const totalItems = mappedData.length;
      let processedItems = 0;

      for (const item of mappedData) {
        if (!item.student_id) continue;

        // Atualizar o status do aluno para "matriculado" e adicionar o código ERP
        const { error } = await supabase
          .from('students')
          .update({
            status: 'matriculado',
            codigo_erp: item.codigo_erp
          })
          .eq('id', item.student_id);

        if (error) {
          console.error('Erro ao atualizar aluno:', error);
          toast.error(`Erro ao atualizar aluno com código CRM ${item.codigo_crm}`);
        } else {
          // Registrar a interação na ficha do estudante
          const description = `Matrícula registrada via importação. Código ERP: ${item.codigo_erp}`;
          await registerInteraction(item.student_id, description);
        }

        processedItems++;
        // Verificar se o componente ainda está montado antes de atualizar o estado
        if (isMounted.current) {
          setImportProgress(Math.round((processedItems / totalItems) * 100));
        }
      }

      toast.success('Importação concluída com sucesso!');
      
      // Limpar dados após importação bem-sucedida
      setFile(null);
      setImportData([]);
      setMappedData([]);
      setValidationErrors([]);
      setShowPreview(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar os dados');
    } finally {
      // Verificar se o componente ainda está montado antes de atualizar o estado
      if (isMounted.current) {
        setIsImporting(false);
        setImportProgress(0);
      }
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['codigo_crm', 'codigo_erp', 'status'],
      // Exemplo: manter como string; Excel já verá como texto
      ['123456', 'ERP001', 'matriculado'],
    ]);

    // Garantir que o cabeçalho da coluna A esteja como texto
    if (worksheet['A1']) {
      worksheet['A1'].t = 's';
      worksheet['A1'].z = '@';
    }

    // Pré-formatar a coluna A (codigo_crm) como Texto em várias linhas
    const MAX_ROWS = 1000; // ajuste conforme necessidade
    for (let r = 2; r <= MAX_ROWS; r++) {
      const cellRef = `A${r}`;
      // Cria célula vazia como texto para que o Excel preserve zeros à esquerda ao colar/digitar
      worksheet[cellRef] = { t: 's', v: '', z: '@' };
    }

    // Expandir o range da planilha para incluir as linhas pré-formatadas
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:C2');
    range.e.r = Math.max(range.e.r, MAX_ROWS);
    worksheet['!ref'] = XLSX.utils.encode_range(range);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    XLSX.writeFile(workbook, 'template_importacao_matriculas.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Baixar Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de Arquivo</CardTitle>
          <CardDescription>
            Selecione um arquivo Excel (.xlsx ou .xls) com os dados de matrícula
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="p-4 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium mb-2">Instruções para preenchimento da planilha:</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
                <li>O arquivo deve conter as colunas: <strong>codigo_crm</strong>, <strong>codigo_erp</strong> e <strong>status</strong></li>
                <li>O <strong>codigo_crm</strong> é o código de 6 dígitos do aluno no Laurel Escolar</li>
                <li>O <strong>codigo_erp</strong> é obrigatório e deve corresponder ao código do aluno no sistema ERP</li>
                <li>O <strong>status</strong> neste caso deve ser preenchido como "matriculado"</li>
                <li>Todos os alunos devem estar previamente cadastrados no sistema</li>
              </ul>
            </div>
            
            <div className="flex items-center justify-start gap-4">
              <input
                id="enrollment-file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls"
                disabled={isValidating || isImporting}
                className="hidden"
              />
              <Button 
                variant="default" 
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600"
                onClick={() => fileInputRef.current?.click()}
                disabled={isValidating || isImporting}
              >
                <Upload className="h-4 w-4" />
                <span>Escolher arquivo</span>
              </Button>
            </div>

            {file && (
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{file.name}</span>
                <Badge variant="outline" className="ml-2">
                  {(file.size / 1024).toFixed(2)} KB
                </Badge>
              </div>
            )}

            {isValidating && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Validando dados...</span>
                </div>
                <Progress value={50} className="h-2 w-full" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia da Importação</CardTitle>
            <CardDescription>
              Verifique os dados antes de confirmar a importação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Foram encontrados {validationErrors.length} erros. Corrija-os antes de continuar.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código CRM</TableHead>
                      <TableHead>Código ERP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Validação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.codigo_crm}</TableCell>
                        <TableCell>{item.codigo_erp}</TableCell>
                        <TableCell>{item.status}</TableCell>
                        <TableCell>
                          {item.errors && item.errors.length > 0 ? (
                            <div className="flex items-center gap-2 text-red-500">
                              <X className="h-4 w-4" />
                              <span className="text-xs">{item.errors.join(', ')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-green-500">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Válido</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {isImporting ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Importando...</span>
                    <span className="text-sm font-medium">{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2 w-full" />
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setImportData([]);
                      setMappedData([]);
                      setValidationErrors([]);
                      setShowPreview(false);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    disabled={isImporting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={validationErrors.length > 0 || isImporting}
                  >
                    Importar Dados
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};