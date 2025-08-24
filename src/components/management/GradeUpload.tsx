
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

interface StudentGrade {
  code: string;
  math_grade?: number;
  portuguese_grade?: number;
}

export const GradeUpload = () => {
  const downloadTemplate = () => {
    const headers = ["Código", "Nota Português", "Nota Matemática"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Notas');
    XLSX.writeFile(wb, `modelo_notas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<StudentGrade[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Preview do arquivo
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const parsedData: StudentGrade[] = jsonData.map((row: any) => ({
        code: row['Código'] || row['codigo'] || row['Code'] || '',
        math_grade: parseFloat(row['Matemática'] || row['matematica'] || row['Math'] || 0),
        portuguese_grade: parseFloat(row['Português'] || row['portugues'] || row['Portuguese'] || 0)
      }));

      setPreview(parsedData.slice(0, 5)); // Mostrar apenas os primeiros 5 para preview
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

      const studentsToUpdate: StudentGrade[] = jsonData.map((row: any) => ({
        code: row['Código'] || row['codigo'] || row['Code'] || '',
        math_grade: parseFloat(row['Matemática'] || row['matematica'] || row['Math'] || 0),
        portuguese_grade: parseFloat(row['Português'] || row['portugues'] || row['Portuguese'] || 0)
      }));

      let successCount = 0;
      let errorCount = 0;

      for (const student of studentsToUpdate) {
        if (!student.code) {
          errorCount++;
          continue;
        }

        try {
          const { error } = await supabase
            .from('students')
            .update({
              math_grade: student.math_grade || null,
              portuguese_grade: student.portuguese_grade || null
            })
            .eq('code', student.code);

          if (error) {
            console.error(`Erro ao atualizar aluno ${student.code}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Erro ao processar aluno ${student.code}:`, error);
          errorCount++;
        }
      }

      toast.success(`Upload concluído! ${successCount} alunos atualizados, ${errorCount} erros.`);
      
      // Limpar formulário
      setFile(null);
      setPreview([]);
      const fileInput = document.getElementById('grade-file') as HTMLInputElement;
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
        <h3 className="text-lg font-semibold">Upload de Notas</h3>
        <p className="text-sm text-gray-600">
          Faça upload de uma planilha Excel (.xlsx) com as notas dos alunos
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
                <li><strong>Código</strong>: Código único do aluno</li>
                <li><strong>Português</strong>: Nota de português </li>
                <li><strong>Matemática</strong>: Nota de matemática </li>
              </ul>
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
            <Label htmlFor="grade-file">Arquivo Excel (.xlsx)</Label>
            <Input
              id="grade-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
            />
          </div>

          {preview.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Preview dos dados:</h4>
              <div className="border rounded p-4 bg-gray-50">
                {preview.map((student, index) => (
                  <div key={index} className="text-sm">
                    Código: {student.code} | Português: {student.portuguese_grade || 'N/A'} | Matemática: {student.math_grade || 'N/A'}
                  </div>
                ))}
                {preview.length === 5 && <div className="text-sm text-gray-500 mt-2">... e mais</div>}
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
