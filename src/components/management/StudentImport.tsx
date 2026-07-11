import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, AlertCircle, CheckCircle, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { TablesInsert } from '@/integrations/supabase/types';

/** Cabeçalhos exatos da planilha modelo */
const TEMPLATE_HEADERS = [
  'estado',
  'código da cidade',
  'cidade',
  'nome da instituição',
  'código da instituição',
  'infantil_count',
  'ef1_count',
  'ef2_count',
  'medio_count',
  'total_students_count',
  'telefone',
  'email',
] as const;

type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

interface ImportData {
  estado: string;
  city_code: string;
  city: string;
  student_name: string;
  inep_code: string;
  infantil_count: string;
  ef1_count: string;
  ef2_count: string;
  medio_count: string;
  total_students_count: string;
  phone: string;
  email: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface MappedData extends ImportData {
  unit_id?: string;
  errors?: string[];
}

const normalizeHeader = (header: string) =>
  header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Mapeia cabeçalho da planilha → campo interno */
const HEADER_TO_FIELD: Record<string, keyof ImportData> = {
  estado: 'estado',
  'codigo da cidade': 'city_code',
  cidade: 'city',
  'nome da instituicao': 'student_name',
  'codigo da instituicao': 'inep_code',
  infantil_count: 'infantil_count',
  ef1_count: 'ef1_count',
  ef2_count: 'ef2_count',
  medio_count: 'medio_count',
  total_students_count: 'total_students_count',
  telefone: 'phone',
  email: 'email',
};

const REQUIRED_HEADERS: TemplateHeader[] = [
  'nome da instituição',
  'código da instituição',
];

const parseCount = (val: string | undefined) => {
  const n = parseInt(String(val ?? '').replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? null : n;
};

export const StudentImport = () => {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportData[]>([]);
  const [mappedData, setMappedData] = useState<MappedData[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        if (jsonData.length < 2) {
          toast.error('A planilha deve ter pelo menos um cabeçalho e uma linha de dados');
          return;
        }

        const headers = (jsonData[0] as string[]).map((h) => String(h ?? ''));
        const normalizedHeaders = headers.map(normalizeHeader);

        const missing = REQUIRED_HEADERS.filter(
          (req) => !normalizedHeaders.includes(normalizeHeader(req)),
        );
        if (missing.length > 0) {
          toast.error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
          return;
        }

        const parsedData: ImportData[] = (jsonData.slice(1) as unknown[][])
          .map((row) => {
            const rowData: Partial<ImportData> = {};
            headers.forEach((header, colIndex) => {
              const field = HEADER_TO_FIELD[normalizeHeader(header)];
              if (field) {
                const raw = row[colIndex];
                rowData[field] = raw == null || raw === '' ? '' : String(raw).trim();
              }
            });
            return rowData as ImportData;
          })
          .filter((row) => row.student_name);

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
      let unitId = profile?.unit_id ?? null;
      if (!unitId) {
        const { data: unitsData } = await supabase.from('units').select('id').order('name').limit(1);
        unitId = unitsData?.[0]?.id ?? null;
      }
      if (!unitId) {
        toast.error('Nenhuma unidade cadastrada. Cadastre uma unidade antes de importar.');
        return;
      }

      const errors: ValidationError[] = [];
      const mapped: MappedData[] = [];

      for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        const rowErrors: string[] = [];
        const rowNumber = i + 2;

        if (!row.student_name?.trim()) {
          errors.push({ row: rowNumber, field: 'nome da instituição', message: 'nome da instituição é obrigatório' });
          rowErrors.push('nome da instituição é obrigatório');
        }

        if (!row.inep_code?.trim()) {
          errors.push({ row: rowNumber, field: 'código da instituição', message: 'código da instituição é obrigatório' });
          rowErrors.push('código da instituição é obrigatório');
        }

        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          errors.push({ row: rowNumber, field: 'email', message: 'Email inválido' });
          rowErrors.push('Email inválido');
        }

        mapped.push({ ...row, unit_id: unitId, errors: rowErrors });
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
      const validData = mappedData.filter((item) => !item.errors || item.errors.length === 0);
      const unitId = validData[0]?.unit_id;
      if (!unitId) {
        toast.error('Unidade não definida para importação');
        return;
      }

      const anoLetivo = new Date().getFullYear();
      const BATCH = 250;
      let successCount = 0;
      let errorCount = 0;
      let lastError = '';

      for (let offset = 0; offset < validData.length; offset += BATCH) {
        const chunk = validData.slice(offset, offset + BATCH).map((item) => ({
          student_name: item.student_name,
          inep_code: item.inep_code || '',
          estado: item.estado || '',
          city_code: item.city_code || '',
          city: item.city || '',
          email: item.email || '',
          phone: item.phone || '',
          infantil_count: item.infantil_count || '',
          ef1_count: item.ef1_count || '',
          ef2_count: item.ef2_count || '',
          medio_count: item.medio_count || '',
          total_students_count: item.total_students_count || '',
        }));

        const { data, error } = await supabase.rpc('import_schools_bulk', {
          p_unit_id: unitId,
          p_rows: chunk,
          p_ano_letivo: String(anoLetivo),
        });

        if (error) {
          console.error('Erro no lote de importação:', error.message, error);
          lastError = error.message;
          const missingRpc =
            error.message?.includes('Could not find the function') ||
            error.message?.includes('schema cache') ||
            error.code === 'PGRST202';

          if (!missingRpc) {
            errorCount += chunk.length;
          } else {
            // Fallback em sublotes menores (triggers de e-mail ainda ativos)
            let fallbackOk = true;
            for (let j = 0; j < chunk.length; j += 50) {
              const sub = chunk.slice(j, j + 50);
              const { error: fallbackError } = await supabase.from('students').insert(
                sub.map((item): TablesInsert<'students'> => ({
                  student_name: item.student_name,
                  inep_code: item.inep_code || null,
                  city: item.city || null,
                  email: item.email || null,
                  phone: item.phone || '',
                  neighborhood: item.estado || null,
                  origin_school: item.city_code || null,
                  infantil_count: parseCount(item.infantil_count),
                  ef1_count: parseCount(item.ef1_count),
                  ef2_count: parseCount(item.ef2_count),
                  medio_count: parseCount(item.medio_count),
                  total_students_count: parseCount(item.total_students_count),
                  status: 'nao_confirmado',
                  unit_id: unitId,
                  ano_letivo: anoLetivo,
                })),
              );
              if (fallbackError) {
                console.error('Fallback também falhou:', fallbackError.message, fallbackError);
                lastError = fallbackError.message;
                errorCount += sub.length;
                fallbackOk = false;
              } else {
                successCount += sub.length;
              }
            }
            if (!fallbackOk && !lastError) lastError = 'falha no fallback';
          }
        } else {
          const inserted = Number((data as { inserted?: number } | null)?.inserted ?? chunk.length);
          successCount += inserted;
        }

        setImportProgress(Math.min(100, ((offset + chunk.length) / validData.length) * 100));
      }

      if (successCount > 0) toast.success(`${successCount} escola(s) importada(s) com sucesso!`);
      if (errorCount > 0) {
        toast.error(
          `${errorCount} escola(s) falharam${lastError ? `: ${lastError}` : ''}. Aplique a migration 20260710220000 no Supabase.`,
        );
      }

      resetImport();
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
        estado: 'SP',
        'código da cidade': '3550308',
        cidade: 'São Paulo',
        'nome da instituição': 'Escola Municipal Exemplo',
        'código da instituição': '12345678',
        infantil_count: 80,
        ef1_count: 200,
        ef2_count: 180,
        medio_count: 120,
        total_students_count: 580,
        telefone: '(11) 3333-4444',
        email: 'contato@escola.edu.br',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData, { header: [...TEMPLATE_HEADERS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Escolas');
    XLSX.writeFile(wb, 'template_importacao_escolas.xlsx');
  };

  const resetImport = () => {
    setImportData([]);
    setMappedData([]);
    setValidationErrors([]);
    setShowPreview(false);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importação de Escolas em Massa
          </CardTitle>
          <CardDescription>
            Importe escolas através de planilha Excel com todos os dados necessários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              {file && <span className="text-sm text-gray-600">{file.name}</span>}
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Obrigatórios:</strong> nome da instituição, código da instituição.
              <br />
              <strong>Colunas:</strong> {TEMPLATE_HEADERS.join(', ')}.
              <br />
              Escolas entram com status Lead Frio na unidade do usuário logado.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={validateAndMapData} disabled={importData.length === 0 || isValidating}>
              {isValidating ? 'Validando...' : 'Validar Dados'}
            </Button>
            <Button onClick={resetImport} variant="outline">
              Limpar
            </Button>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importando escolas...</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Dados</CardTitle>
            <CardDescription>
              {validationErrors.length === 0
                ? 'Todos os dados estão válidos e prontos para importação'
                : `${validationErrors.length} erro(s) encontrado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold">{mappedData.length}</div>
                <div className="text-sm text-gray-600">Total de Registros</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {mappedData.filter((item) => !item.errors || item.errors.length === 0).length}
                </div>
                <div className="text-sm text-gray-600">Válidos</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">{validationErrors.length}</div>
                <div className="text-sm text-gray-600">Com Erros</div>
              </div>
            </div>

            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Total Alunos</TableHead>
                    <TableHead>Validação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 2}</TableCell>
                      <TableCell>{item.student_name}</TableCell>
                      <TableCell>{item.inep_code || '—'}</TableCell>
                      <TableCell>{item.city || '—'}</TableCell>
                      <TableCell>{item.estado || '—'}</TableCell>
                      <TableCell>{item.total_students_count || '—'}</TableCell>
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

            {validationErrors.length === 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={executeImport}
                  disabled={isImporting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isImporting ? 'Importando...' : 'Importar Escolas'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
