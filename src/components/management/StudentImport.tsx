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
    'ano_letivo',
    'unidade',
    'turma'
  ];

  // Status válidos
  const validStatuses = [
    'nao_confirmado',
    'confirmado',
    'cadastro_invalido',
    'nenhum_agendamento',
    'atendimento_agendado',
    'atendimento_recentemente',
    'atendimento_ha_mais_de_uma_semana',
    'faltou_ao_atendimento',
    'desistente',
    'matriculado',
    'ausente',
    'processo_anos_anteriores'
  ];

  const loadReferenceData = async () => {
    try {
      console.log('🔄 Carregando dados de referência...');
      
      // Carregar unidades
      const { data: unitsData, error: unitsError } = await supabase.from('units').select('*');
      if (unitsError) {
        console.error('❌ Erro ao carregar unidades:', unitsError);
        toast.error('Erro ao carregar unidades');
        return { units: [], classes: [] };
      }
      
      console.log('✅ Unidades carregadas:', unitsData?.map(u => ({ id: u.id, name: u.name })));
      setUnits(unitsData || []);

      // Carregar turmas com unidades
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          units(*)
        `);
      if (classesError) {
        console.error('❌ Erro ao carregar turmas:', classesError);
        toast.error('Erro ao carregar turmas');
        return { units: unitsData || [], classes: [] };
      }
      
      console.log('✅ Turmas carregadas:', classesData?.map(c => ({ 
        id: c.id, 
        name: c.name, 
        unit_id: c.unit_id,
        unit_name: c.units?.name 
      })));
      setClasses(classesData || []);
      
      // Retornar os dados diretamente para uso na validação
      return { units: unitsData || [], classes: classesData || [] };
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados de referência:', error);
      toast.error('Erro ao carregar dados de referência');
      return { units: [], classes: [] };
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

        console.log('📋 Cabeçalhos encontrados:', headers);

        // Verificar se todos os campos obrigatórios estão presentes
        const missingFields = requiredFields.filter(field => 
          !headers.some(header => header?.toLowerCase().trim() === field)
        );

        if (missingFields.length > 0) {
          toast.error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
          return;
        }

        // Função para converter data do Excel para formato ISO
        const convertExcelDate = (excelValue: any): string => {
          if (!excelValue) return '';
          
          // Se já é uma string no formato de data, retornar como está
          if (typeof excelValue === 'string') {
            // Verificar se é um número de série do Excel (ex: "40445")
            if (/^\d+$/.test(excelValue)) {
              const excelDate = parseInt(excelValue);
              const date = new Date((excelDate - 25569) * 86400 * 1000);
              return date.toISOString().split('T')[0];
            }
            return excelValue;
          }
          
          // Se é um número (número de série do Excel)
          if (typeof excelValue === 'number') {
            const date = new Date((excelValue - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
          }
          
          return String(excelValue);
        };

        // Converter dados para o formato esperado
        const parsedData: ImportData[] = rows.map((row, index) => {
          const rowData: any = {};
          headers.forEach((header, colIndex) => {
            const fieldName = header?.toLowerCase().trim();
            if (requiredFields.includes(fieldName)) {
              let value = row[colIndex] || '';
              
              // Converter data de nascimento se necessário
              if (fieldName === 'birth_date') {
                value = convertExcelDate(value);
              }
              
              rowData[fieldName] = value;
            }
          });
          return rowData as ImportData;
        }).filter(row => row.student_name); // Filtrar linhas vazias

        console.log('📊 Dados parseados:', parsedData);
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
      // Carregar dados de referência e usar diretamente na validação
      const { units: loadedUnits, classes: loadedClasses } = await loadReferenceData();
      
      const errors: ValidationError[] = [];
      const mapped: MappedData[] = [];

      console.log('🔍 Iniciando validação...');
      console.log('📚 Unidades disponíveis:', loadedUnits.map(u => u.name));
      console.log('🏫 Turmas disponíveis:', loadedClasses.map(c => `${c.name} (${c.units?.name})`));

      for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        const rowErrors: string[] = [];
        const rowNumber = i + 2; // +2 porque a planilha começa na linha 1 e pula o cabeçalho

        console.log(`🔍 Validando linha ${rowNumber}:`, row);

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

        // Validação especial para tag (opcional)
        if (row.tag && String(row.tag).trim() === '') {
          // Se tag estiver presente mas vazia, definir como undefined
          row.tag = undefined;
        }

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

        // Mapear unidade - usando dados carregados diretamente
        console.log(`🔍 Buscando unidade: "${row.unidade}"`);
        const unit = loadedUnits.find(u => {
          const match = u.name.toLowerCase().trim() === row.unidade.toLowerCase().trim();
          console.log(`  - Comparando: "${u.name.toLowerCase().trim()}" === "${row.unidade.toLowerCase().trim()}" = ${match}`);
          return match;
        });
        
        if (!unit) {
          console.log(`❌ Unidade "${row.unidade}" não encontrada`);
          errors.push({
            row: rowNumber,
            field: 'unidade',
            message: `Unidade "${row.unidade}" não encontrada. Unidades disponíveis: ${loadedUnits.map(u => u.name).join(', ')}`
          });
          rowErrors.push(`Unidade "${row.unidade}" não encontrada`);
        } else {
          console.log(`✅ Unidade encontrada:`, unit);
        }

        // Mapear turma - usando dados carregados diretamente
        console.log(`🔍 Buscando turma: "${row.turma}" na unidade: "${unit?.name}"`);
        const classItem = loadedClasses.find(c => {
          const nameMatch = c.name.toLowerCase().trim() === row.turma.toLowerCase().trim();
          const unitMatch = c.unit_id === unit?.id;
          console.log(`  - Turma: "${c.name.toLowerCase().trim()}" === "${row.turma.toLowerCase().trim()}" = ${nameMatch}`);
          console.log(`  - Unidade: "${c.unit_id}" === "${unit?.id}" = ${unitMatch}`);
          return nameMatch && unitMatch;
        });
        
        if (!classItem) {
          console.log(`❌ Turma "${row.turma}" não encontrada na unidade "${row.unidade}"`);
          errors.push({
            row: rowNumber,
            field: 'turma',
            message: `Turma "${row.turma}" não encontrada na unidade "${row.unidade}". Turmas disponíveis: ${loadedClasses.filter(c => c.unit_id === unit?.id).map(c => c.name).join(', ')}`
          });
          rowErrors.push(`Turma "${row.turma}" não encontrada na unidade "${row.unidade}"`);
        } else {
          console.log(`✅ Turma encontrada:`, classItem);
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
               tag: item.tag || null, // Permitir null se tag estiver vazia
               ano_letivo: item.ano_letivo,
               unit_id: item.unit_id,
               class_id: item.class_id,
               neighborhood: '', // Campo obrigatório, será preenchido com valor padrão
               origin_school: '' // Campo obrigatório, será preenchido com valor padrão
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
        status: 'processo_anos_anteriores',
        tag: 'Inscrito para 2025',
        ano_letivo: '2025',
        unidade: 'Central',
        turma: '6º ano'
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
            <div className="flex items-center space-x-4">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Upload className="h-4 w-4 mr-2" />
                Escolher Arquivo
              </Button>
              {file && (
                <span className="text-sm text-gray-600">
                  {file.name}
                </span>
              )}
            </div>
          </div>

          {/* Campos obrigatórios */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Campos obrigatórios:</strong> student_name (Nome do aluno), responsible_name (Nome do responsável), email, phone (telefone principal), birth_date (data de nascimento), status, ano_letivo, unidade, serie, turma.
              <br />
              <strong>Campos opcionais:</strong> tag (tag do aluno).
              <br />
              <strong>Atenção:</strong> Siga o template de importação para garantir que os dados estarão corretos. Utilize o mesmo formato de data e telefone. 
              <br />
              <p>Para preencher Unidade, Série e Turma, utilize exatamente o mesmo nome que está no sistema para evitar erros na importação.</p>
              <br />
              <p>Após fazer o upload do arquivo, clique em "Validar Dados" para verificar se os dados estão corretos. Caso algum campo esteja incorreto, corrija-o e clique em "Validar Dados" novamente.</p>
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
                     <TableHead>Tag</TableHead>
                     <TableHead>Ano Letivo</TableHead>
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
                        {item.tag && <Badge variant="secondary">{item.tag}</Badge>}
                      </TableCell>
                      <TableCell>
                        {item.ano_letivo && <Badge variant="outline">{item.ano_letivo}</Badge>}
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
