import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getCurrentDate } from '@/utils/dateUtils';

interface ClassData {
  name: string;
  series: string;
  unit: string;
  annuity: number;
  parcelas: number;
  material_anual: number;
  tem_prova: boolean;
}

interface ClassUploadProps {
  onUploadSuccess?: () => void;
}

export const ClassUpload = ({ onUploadSuccess }: ClassUploadProps) => {
  const downloadTemplate = () => {
    const headers = [
      "Nome", 
      "Série", 
      "Unidade", 
      "Anuidade", 
      "Parcelas", 
      "Material Anual", 
      "Tem Prova"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Turmas');
    XLSX.writeFile(wb, `modelo_turmas_${getCurrentDate()}.xlsx`);
  };

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ClassData[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]); // Limpar erros anteriores

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const parsedData: ClassData[] = jsonData.map((row: any) => ({
        name: row['Nome'] || row['nome'] || row['Name'] || '',
        series: row['Série'] || row['serie'] || row['Series'] || '',
        unit: row['Unidade'] || row['unidade'] || row['Unit'] || '',
        annuity: parseFloat(row['Anuidade'] || row['anuidade'] || row['Annuity'] || '0'),
        parcelas: parseInt(row['Parcelas'] || row['parcelas'] || row['Parcels'] || '0'),
        material_anual: parseFloat(row['Material Anual'] || row['material_anual'] || row['Material'] || '0'),
        tem_prova: row['Tem Prova'] === 'Sim' || row['Tem Prova'] === 'sim' || row['Tem Prova'] === 'SIM' || row['Tem Prova'] === true || row['Tem Prova'] === '1'
      }));

      setPreview(parsedData.slice(0, 5));
    } catch (error) {
      toast.error('Erro ao ler arquivo. Verifique o formato.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const classesToCreate: ClassData[] = jsonData.map((row: any) => ({
        name: row['Nome'] || row['nome'] || row['Name'] || '',
        series: row['Série'] || row['serie'] || row['Series'] || '',
        unit: row['Unidade'] || row['unidade'] || row['Unit'] || '',
        annuity: parseFloat(row['Anuidade'] || row['anuidade'] || row['Annuity'] || '0'),
        parcelas: parseInt(row['Parcelas'] || row['parcelas'] || row['Parcels'] || '0'),
        material_anual: parseFloat(row['Material Anual'] || row['material_anual'] || row['Material'] || '0'),
        tem_prova: row['Tem Prova'] === 'Sim' || row['Tem Prova'] === 'sim' || row['Tem Prova'] === 'SIM' || row['Tem Prova'] === true || row['Tem Prova'] === '1'
      }));

      let successCount = 0;
      let errorCount = 0;
      const uploadErrors: string[] = [];

      for (const classData of classesToCreate) {
        if (!classData.name || !classData.series || !classData.unit) {
          errorCount++;
          uploadErrors.push(`Turma sem nome, série ou unidade: ${classData.name || 'N/A'}`);
          continue;
        }

        try {
          // Buscar IDs das séries e unidades
          const { data: seriesData, error: seriesError } = await supabase
            .from('series')
            .select('id, name')
            .ilike('name', `%${classData.series}%`)
            .single();

          if (seriesError || !seriesData) {
            errorCount++;
            uploadErrors.push(`Série não encontrada: ${classData.series}`);
            continue;
          }

          const { data: unitData, error: unitError } = await supabase
            .from('units')
            .select('id, name')
            .ilike('name', `%${classData.unit}%`)
            .single();

          if (unitError || !unitData) {
            errorCount++;
            uploadErrors.push(`Unidade não encontrada: ${classData.unit}`);
            continue;
          }

          // Verificar se já existe uma turma com o mesmo nome na mesma unidade
          const { data: existingClass } = await supabase
            .from('classes')
            .select('id')
            .eq('name', classData.name)
            .eq('unit_id', unitData.id)
            .single();

          if (existingClass) {
            errorCount++;
            uploadErrors.push(`Turma já existe: ${classData.name} na unidade ${unitData.name}`);
            continue;
          }

          // Calcular mensalidade e material mensal
          const monthlyFee = classData.parcelas > 0 ? classData.annuity / classData.parcelas : 0;
          const materialMensal = classData.parcelas > 0 ? classData.material_anual / classData.parcelas : 0;

          // Criar turma
          const { error } = await supabase
            .from('classes')
            .insert({
              name: classData.name,
              series_id: seriesData.id,
              unit_id: unitData.id,
              has_exam: classData.tem_prova,
              monthly_fee: monthlyFee,
              annuity: classData.annuity,
              parcelas: classData.parcelas,
              material_didatico_anual: classData.material_anual,
              material_didatico_mes: materialMensal
            });

          if (error) {
            console.error(`Erro ao criar turma ${classData.name}:`, error);
            errorCount++;
            uploadErrors.push(`Erro ao criar turma ${classData.name}: ${error.message}`);
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Erro ao processar turma ${classData.name}:`, error);
          errorCount++;
          uploadErrors.push(`Erro ao processar turma ${classData.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }

      // Mostrar resultado
      if (successCount > 0) {
        toast.success(`Upload concluído! ${successCount} turmas criadas.`);
        // Chamar callback para atualizar a lista
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
      
      if (errorCount > 0) {
        setErrors(uploadErrors);
        toast.error(`${errorCount} erros encontrados. Verifique os detalhes.`);
      } else {
        setErrors([]);
      }
      
      // Limpar formulário
      setFile(null);
      setPreview([]);
      const fileInput = document.getElementById('class-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao processar arquivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Upload de Turmas</h3>
        <p className="text-sm text-gray-600">
          Faça upload de uma planilha Excel (.xlsx) com as turmas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Formato da Planilha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A planilha deve conter as colunas:
              <ul className="list-disc list-inside mt-2">
                <li><strong>Nome</strong>: Nome da turma</li>
                <li><strong>Série</strong>: Nome da série (Deve estar igual ao nome da série no sistema)</li>
                <li><strong>Unidade</strong>: Nome da unidade (Deve estar igual ao nome da unidade no sistema)</li>
                <li><strong>Anuidade</strong>: Valor da anuidade</li>
                <li><strong>Parcelas</strong>: Número de parcelas</li>
                <li><strong>Material Anual</strong>: Valor do material anual</li>
                <li><strong>Tem Prova</strong>: Sim/Não (Preencher com Sim ou Não)</li>
              </ul>
              <p className="mt-2 text-sm">
                <strong>Nota:</strong> Mensalidade e Material Mensal são calculados automaticamente.
              </p>
            </AlertDescription>
          </Alert>
          <Button onClick={downloadTemplate} className="mt-4">
            <Download className="h-4 w-4 mr-2" />
            Baixar modelo de planilha
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="class-file">Arquivo Excel (.xlsx)</Label>
            <div className="flex items-center space-x-4">
              <Input
                id="class-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => document.getElementById('class-file')?.click()}
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

          {preview.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Preview dos dados:</h4>
              <div className="border rounded p-4 bg-gray-50">
                {preview.map((classData, index) => (
                  <div key={index} className="text-sm mb-2 p-2 bg-white rounded border">
                    <div><strong>Nome:</strong> {classData.name}</div>
                    <div><strong>Série:</strong> {classData.series}</div>
                    <div><strong>Unidade:</strong> {classData.unit}</div>
                    <div><strong>Anuidade:</strong> R$ {classData.annuity.toFixed(2)}</div>
                    <div><strong>Parcelas:</strong> {classData.parcelas}</div>
                    <div><strong>Material Anual:</strong> R$ {classData.material_anual.toFixed(2)}</div>
                    <div><strong>Tem Prova:</strong> {classData.tem_prova ? 'Sim' : 'Não'}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      <strong>Mensalidade calculada:</strong> R$ {classData.parcelas > 0 ? (classData.annuity / classData.parcelas).toFixed(2) : '0.00'}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Material mensal calculado:</strong> R$ {classData.parcelas > 0 ? (classData.material_anual / classData.parcelas).toFixed(2) : '0.00'}
                    </div>
                  </div>
                ))}
                {preview.length === 5 && <div className="text-sm text-gray-500 mt-2">... e mais</div>}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-red-600">Erros encontrados:</h4>
              <div className="border border-red-200 rounded p-4 bg-red-50 max-h-40 overflow-y-auto">
                {errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-700 mb-1">
                    • {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button 
            onClick={handleUpload} 
            disabled={!file || loading}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {loading ? 'Processando...' : 'Fazer Upload'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
