import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StudentDataSection } from './registration/StudentDataSection';
import { ResponsibleDataSection } from './registration/ResponsibleDataSection';
// import { AddressSection } from './registration/AddressSection'; // Removido - campos não mais utilizados
import { AcademicDataSection } from './registration/AcademicDataSection';
import { RegistrationSourceSection } from './registration/RegistrationSourceSection';
import { useRegistrationData } from '@/hooks/useRegistrationData';
import { useRegistrationSources } from '@/hooks/useRegistrationSources';
import { useTrackingCode } from '@/hooks/useTrackingCode';
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
  const { unitSlug } = useParams<{ unitSlug?: string }>();
  const [formData, setFormData] = useState<RegistrationFormData>({
    studentName: '',
    responsibleName: '',
    birthDate: '',
    phone: '',
    additionalPhones: [],
    email: '',
    cityId: '',
    cityName: '',
    neighborhood: '',
    originSchool: '',
    seriesId: '',
    classId: '',
    unitId: '',
    registrationSourceId: ''
  });

  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [preSelectedUnit, setPreSelectedUnit] = useState<Unit | null>(null);
  const [isUnitLocked, setIsUnitLocked] = useState(false);

  const { series, classes, loading: dataLoading, error: dataError, refetch } = useRegistrationData();
  const { hasSources } = useRegistrationSources(formData.unitId);
  const { activeTrackingCode } = useTrackingCode();

  // Detectar e pré-selecionar unidade baseado no slug da URL
  useEffect(() => {
    const loadUnitBySlug = async () => {
      if (unitSlug) {
        console.log('🔗 Slug detectado na URL:', unitSlug);
        
        try {
          const { data: units, error } = await (supabase as any)
            .from('units')
            .select('*')
            .eq('slug', unitSlug);
          
          const unit = units?.[0];

          if (error) {
            console.error('Erro ao buscar unidade pelo slug:', error);
            toast.error(`Unidade "${unitSlug}" não encontrada. Redirecionando...`);
            setTimeout(() => navigate('/inscricao'), 2000);
            return;
          }

          if (unit) {
            console.log('✅ Unidade encontrada:', unit);
            setPreSelectedUnit(unit);
            setIsUnitLocked(true);
            // Não pré-seleciona o unitId ainda, apenas quando a série for escolhida
          }
        } catch (err) {
          console.error('Erro ao buscar unidade:', err);
          toast.error('Erro ao carregar informações da unidade');
        }
      }
    };

    loadUnitBySlug();
  }, [unitSlug, navigate]);

  // Filtrar unidades quando série é selecionada
  useEffect(() => {
    if (formData.seriesId) {
      const filteredClasses = classes.filter(cls => cls.series_id === formData.seriesId);
      
      // Extrair unidades únicas das turmas filtradas
      // Filtrar turmas que têm unidades válidas (não null)
      const validClasses = filteredClasses.filter(cls => cls.units !== null);
      
      const uniqueUnits = validClasses
        .map(cls => cls.units)
        .filter((unit, index, arr) => {
          // Verificar se unit é válido antes de usar
          if (!unit || !unit.id) return false;
          return arr.findIndex(u => u && u.id && u.id === unit.id) === index;
        });
      
      // Se há uma unidade pré-selecionada, filtrar apenas ela
      if (preSelectedUnit && isUnitLocked) {
        const unitInList = uniqueUnits.find(u => u.id === preSelectedUnit.id);
        if (unitInList) {
          setAvailableUnits([unitInList]);
          // Auto-selecionar a unidade
          setFormData(prev => ({ ...prev, unitId: unitInList.id, classId: '' }));
        } else {
          // A unidade pré-selecionada não tem turmas para esta série
          setAvailableUnits([]);
          toast.warning('Esta unidade não possui turmas para a série selecionada');
          setFormData(prev => ({ ...prev, classId: '', unitId: '' }));
        }
      } else {
        setAvailableUnits(uniqueUnits);
        // Limpar seleções dependentes
        setFormData(prev => ({ ...prev, classId: '', unitId: '' }));
      }
      
      setAvailableClasses([]);
    } else {
      setAvailableClasses([]);
      setAvailableUnits([]);
    }
  }, [formData.seriesId, classes, preSelectedUnit, isUnitLocked]);

  // Lógica inteligente de seleção de turma
  useEffect(() => {
    if (formData.unitId && formData.seriesId) {
      const filteredClasses = classes.filter(
        cls => cls.series_id === formData.seriesId 
          && cls.unit_id === formData.unitId
          && cls.units !== null // Adicionar verificação para units não nulo
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

  const handleAdditionalPhonesChange = (additionalPhones: string[]) => {
    setFormData(prev => ({ ...prev, additionalPhones }));
    
    // Limpar erros relacionados a telefones adicionais
    const phoneErrorKeys = Object.keys(fieldErrors).filter(key => key.startsWith('additionalPhones.'));
    if (phoneErrorKeys.length > 0) {
      setFieldErrors(prev => {
        const updated = { ...prev };
        phoneErrorKeys.forEach(key => delete updated[key]);
        return updated;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Sanitizar dados do formulário antes da validação
    const sanitizedFormData = sanitizeRegistrationData(formData);
    
    const errors = validateForm(sanitizedFormData, hasSources);
    
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
        birth_date: null, // Campo removido do formulário
        phone: sanitizedFormData.phone,
        email: sanitizedFormData.email,
        city: null, // Campo removido do formulário
        neighborhood: sanitizedFormData.neighborhood,
        origin_school: '', // Campo removido - sempre vazio
        class_id: sanitizedFormData.classId,
        unit_id: sanitizedFormData.unitId,
        registration_source_id: hasSources ? sanitizedFormData.registrationSourceId : null,
        tracking_code: activeTrackingCode, // Código de rastreamento capturado da URL
        status: selectedClass?.has_exam ? 'nao_confirmado' as const : 'nenhum_agendamento' as const
      };

      const { data: studentResult, error } = await supabase
        .from('students')
        .insert(studentData)
        .select('id')
        .single();

      if (error) throw error;

      // Inserir telefones adicionais na tabela student_phones
      if (sanitizedFormData.additionalPhones && sanitizedFormData.additionalPhones.length > 0) {
        const validAdditionalPhones = sanitizedFormData.additionalPhones.filter(phone => {
          if (!phone) return false;
          const digitsOnly = phone.replace(/\D/g, '');
          return digitsOnly.length === 10 || digitsOnly.length === 11;
        });

        if (validAdditionalPhones.length > 0) {
          const phoneInserts = validAdditionalPhones.map(phone => ({
            student_id: studentResult.id,
            phone_number: phone
          }));

          const { error: phoneError } = await supabase
            .from('student_phones')
            .insert(phoneInserts);

          if (phoneError) {
            console.error('Erro ao inserir telefones adicionais:', phoneError);
            // Não falha a inscrição se houver erro nos telefones adicionais
          }
        }
      }

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
        additionalPhones: [],
        email: '',
        cityId: '',
        cityName: '',
        neighborhood: '',
        originSchool: '',
        seriesId: '',
        classId: '',
        unitId: '',
        registrationSourceId: ''
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
        {/* Logo do Apogeu */}
        <div className="flex justify-center mb-6">
          <img 
            src="/logo_apogeu_nobg.png" 
            alt="Rede de Ensino Apogeu" 
            className="h-20 w-auto object-contain"
          />
        </div>
        
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
            onAdditionalPhonesChange={handleAdditionalPhonesChange}
          />

              <AcademicDataSection
                formData={formData}
                fieldErrors={fieldErrors}
                series={series}
                availableClasses={availableClasses}
                availableUnits={availableUnits}
                showClassSelector={showClassSelector}
                onInputChange={handleInputChange}
                isUnitLocked={isUnitLocked}
                preSelectedUnitName={preSelectedUnit?.name}
              />

              <RegistrationSourceSection
                formData={formData}
                fieldErrors={fieldErrors}
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