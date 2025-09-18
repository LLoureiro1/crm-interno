import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StudentDataSection } from './registration/StudentDataSection';
import { ResponsibleDataSection } from './registration/ResponsibleDataSection';
import { AddressSection } from './registration/AddressSection';
import { AcademicDataSection } from './registration/AcademicDataSection';
import { useRegistrationData } from '@/hooks/useRegistrationData';
import { validateForm, convertDateToISO } from '@/utils/registrationValidation';
import { sanitizeRegistrationData } from '@/utils/sanitization';
import { RegistrationFormData, ValidationErrors } from '@/types/registration';
import type { Tables } from '@/integrations/supabase/types';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Unit = Tables<'units'>;
type Serie = Tables<'series'>;
type Class = Tables<'classes'> & {
  series: Serie;
  units: Unit;
};

export const RegistrationForm = () => {
  console.log('📝 RegistrationForm renderizado');
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegistrationFormData>({
    studentName: '',
    responsibleName: '',
    birthDate: '',
    phone: '',
    email: '',
    cityId: '',
    cityName: '',
    neighborhood: '',
    originSchool: '',
    seriesId: '',
    classId: '',
    unitId: ''
  });

  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});

  const { series, classes, loading: dataLoading, error: dataError, refetch } = useRegistrationData();

  // Filtrar unidades quando série é selecionada
  useEffect(() => {
    if (formData.seriesId) {
      const filteredClasses = classes.filter(cls => cls.series_id === formData.seriesId);
      
      // Extrair unidades únicas das turmas filtradas
      const uniqueUnits = filteredClasses
        .map(cls => cls.units)
        .filter((unit, index, arr) => arr.findIndex(u => u.id === unit.id) === index);
      setAvailableUnits(uniqueUnits);
      
      // Limpar seleções dependentes e não mostrar turmas ainda
      setFormData(prev => ({ ...prev, classId: '', unitId: '' }));
      setAvailableClasses([]);
    } else {
      setAvailableClasses([]);
      setAvailableUnits([]);
    }
  }, [formData.seriesId, classes]);

  // Lógica inteligente de seleção de turma
  useEffect(() => {
    if (formData.unitId && formData.seriesId) {
      const filteredClasses = classes.filter(
        cls => cls.series_id === formData.seriesId && cls.unit_id === formData.unitId
      );
      
      setAvailableClasses(filteredClasses);
      
      if (filteredClasses.length === 1) {
        // ✅ Apenas 1 turma → Auto-atribuir
        setFormData(prev => ({ ...prev, classId: filteredClasses[0].id }));
        setShowClassSelector(false);
      } else if (filteredClasses.length > 1) {
        // ⚠️ Múltiplas turmas → Mostrar seletor
        setFormData(prev => ({ ...prev, classId: '' }));
        setShowClassSelector(true);
      } else {
        // ❌ Nenhuma turma → Limpar
        setFormData(prev => ({ ...prev, classId: '' }));
        setShowClassSelector(false);
      }
    } else {
      setAvailableClasses([]);
      setShowClassSelector(false);
      setFormData(prev => ({ ...prev, classId: '' }));
    }
  }, [formData.unitId, formData.seriesId, classes]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando ele for alterado
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Sanitizar dados do formulário antes da validação
    const sanitizedFormData = sanitizeRegistrationData(formData);
    
    const errors = validateForm(sanitizedFormData);
    
    // Validação adicional: se há múltiplas turmas, uma deve ser selecionada
    if (showClassSelector && !sanitizedFormData.classId) {
      errors.classId = 'Selecione uma turma';
    }
    
    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast.error('Por favor, corrija os campos destacados em vermelho');
      return;
    }

    setLoading(true);

    try {
      const selectedClass = availableClasses.find(cls => cls.id === sanitizedFormData.classId);
      
      const studentData = {
        student_name: sanitizedFormData.studentName,
        responsible_name: sanitizedFormData.responsibleName,
        birth_date: convertDateToISO(sanitizedFormData.birthDate),
        phone: sanitizedFormData.phone,
        email: sanitizedFormData.email,
        city: sanitizedFormData.cityName,
        neighborhood: sanitizedFormData.neighborhood,
        origin_school: '', // Campo removido - sempre vazio
        class_id: sanitizedFormData.classId,
        unit_id: sanitizedFormData.unitId,
        status: selectedClass?.has_exam ? 'nao_confirmado' as const : 'nenhum_agendamento' as const
      };

      const { error } = await supabase
        .from('students')
        .insert(studentData);

      if (error) throw error;

      toast.success('Inscrição realizada com sucesso!');
      
      // Redirecionar para a tela de confirmação
      navigate('/confirmacao', {
        state: {
          classId: formData.classId,
          hasExam: selectedClass?.has_exam
        }
      });

      // Limpar formulário
      setFormData({
        studentName: '',
        responsibleName: '',
        birthDate: '',
        phone: '',
        email: '',
        cityId: '',
        cityName: '',
        neighborhood: '',
        originSchool: '',
        seriesId: '',
        classId: '',
        unitId: ''
      });
      setFieldErrors({});

    } catch (error) {
      console.error('Erro ao realizar inscrição:', error);
      toast.error('Erro ao realizar inscrição. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading enquanto carrega dados iniciais
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-blue-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
              <p className="text-gray-600">Carregando dados do formulário...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Mostrar erro se houver problema no carregamento
  if (dataError) {
    return (
      <div className="min-h-screen bg-blue-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-8">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Erro ao carregar dados: {dataError}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refetch}
                    className="ml-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center text-gray-900">
              Inscrição de Candidatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <StudentDataSection
                formData={formData}
                fieldErrors={fieldErrors}
                onInputChange={handleInputChange}
              />

              <ResponsibleDataSection
                formData={formData}
                fieldErrors={fieldErrors}
                onInputChange={handleInputChange}
              />

              <AddressSection
                formData={formData}
                fieldErrors={fieldErrors}
                cities={[]}
                onInputChange={handleInputChange}
              />

              <AcademicDataSection
                formData={formData}
                fieldErrors={fieldErrors}
                series={series}
                availableClasses={availableClasses}
                availableUnits={availableUnits}
                showClassSelector={showClassSelector}
                onInputChange={handleInputChange}
              />

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={loading || dataLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Realizando Inscrição...
                  </>
                ) : (
                  'Realizar Inscrição'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};