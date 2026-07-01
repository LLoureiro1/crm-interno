import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StudentDataSection } from './registration/StudentDataSection';
import { ResponsibleDataSection } from './registration/ResponsibleDataSection';
// import { AddressSection } from './registration/AddressSection'; // Removido - campos não mais utilizados
import { AcademicDataSection } from './registration/AcademicDataSection';
import { RegistrationSourceSection } from './registration/RegistrationSourceSection';
import { RegistrationLandingLayout } from './registration/RegistrationLandingLayout';
import { useRegistrationData } from '@/hooks/useRegistrationData';
import { useRegistrationSources } from '@/hooks/useRegistrationSources';
import { useTrackingCode } from '@/hooks/useTrackingCode';
import { validateForm, convertDateToISO } from '@/utils/registrationValidation';
import { getCurrentDate } from '@/utils/dateUtils';
import { sanitizeRegistrationData } from '@/utils/sanitization';
import { storeRegistrationToken } from '@/utils/registrationToken';
import { RegistrationFormData, ValidationErrors } from '@/types/registration';
import type { Tables } from '@/integrations/supabase/types';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useUnitAccess } from '@/hooks/useUnitAccess';

const montserrat = "font-['Montserrat',ui-sans-serif,system-ui,sans-serif]";

type Unit = Tables<'units'> & { slug?: string };
type Serie = Tables<'series'>;
type Class = Tables<'classes'> & {
  series: Serie;
  units: Unit;
};

export const RegistrationForm = () => {
  const navigate = useNavigate();
  const { unitSlug } = useParams<{ unitSlug?: string }>();
  const { user, profile } = useAuth();
  const { fullAccess, allowedUnitIds } = useUnitAccess();
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
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');

  const { series, classes, loading: dataLoading, error: dataError, refetch } = useRegistrationData();
  const { hasSources, loading: sourcesLoading, error: sourcesError } = useRegistrationSources(formData.unitId);
  const { activeTrackingCode } = useTrackingCode();

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
            if (!user && String(unit.name).toLowerCase() === 'central') {
              toast.error('A unidade Central não está disponível para inscrição online.');
              setTimeout(() => navigate('/inscricao'), 2000);
              return;
            }
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
  }, [unitSlug, navigate, user]);

  useEffect(() => {
    if (formData.seriesId) {
      const filteredClasses = classes.filter(cls => cls.series_id === formData.seriesId);

      // Extrair unidades únicas das turmas filtradas pela série
      // Filtrar turmas que têm unidades válidas (não null)
      const validClasses = filteredClasses.filter(cls => cls.units !== null);

      const uniqueUnits = validClasses
        .map(cls => cls.units)
        .filter((unit, index, arr) => {
          if (!unit || !unit.id) return false;
          return arr.findIndex(u => u && u.id && u.id === unit.id) === index;
        });

      let visibleUnits = uniqueUnits;

      if (!profile) {
        // Usuário anônimo: ocultar Central
        visibleUnits = uniqueUnits.filter(unit => String(unit.name).toLowerCase() !== 'central');
      } else {
        const isAdminOrDirecao = profile.profile === 'admin' || profile.profile === 'direcao';

        if (isAdminOrDirecao || fullAccess) {
          visibleUnits = uniqueUnits;
        } else if (allowedUnitIds.length > 0) {
          const allowed = new Set(allowedUnitIds);
          visibleUnits = uniqueUnits.filter((unit) => unit?.id && allowed.has(unit.id));
        } else if (profile.unit_id) {
          visibleUnits = uniqueUnits.filter((unit) => unit.id === profile.unit_id);
        } else {
          visibleUnits = uniqueUnits.filter(unit => String(unit.name).toLowerCase() !== 'central');
        }
      }

      // Se há uma unidade pré-selecionada por slug, filtrar apenas ela
      if (preSelectedUnit && isUnitLocked) {
        const unitInList = visibleUnits.find(u => u.id === preSelectedUnit.id);
        if (unitInList) {
          setAvailableUnits([unitInList]);
          setFormData(prev => ({ ...prev, unitId: unitInList.id, classId: '' }));
        } else {
          setAvailableUnits([]);
          toast.warning('Esta unidade não possui turmas para a série selecionada');
          setFormData(prev => ({ ...prev, classId: '', unitId: '' }));
        }
      } else {
        setAvailableUnits(visibleUnits);
        setFormData(prev => ({ ...prev, classId: '', unitId: '' }));
      }

      setAvailableClasses([]);
    } else {
      setAvailableClasses([]);
      setAvailableUnits([]);
    }
  }, [formData.seriesId, classes, preSelectedUnit, isUnitLocked, profile, fullAccess, allowedUnitIds]);

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

    const errors = validateForm(sanitizedFormData, hasSources, {
      sourcesError: !!sourcesError,
      sourcesLoading
    });

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

      // Se a turma possui exame, buscar a próxima data de exame para a unidade
      let nextExam: { id: string; exam_date: string } | null = null;
      if (selectedClass?.has_exam) {
        const { data: examData, error: examError } = await supabase
          .from('exam_dates')
          .select('id, exam_date, exam_time')
          .eq('unit_id', sanitizedFormData.unitId)
          .gte('exam_date', getCurrentDate())
          .order('exam_date', { ascending: true })
          .limit(5);

        if (!examError && examData && examData.length > 0) {
          const now = new Date();
          const todayStr = getCurrentDate();
          const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

          const validExam = examData.find(exam => {
            if (exam.exam_date > todayStr) return true;
            if (exam.exam_date === todayStr && exam.exam_time && exam.exam_time > currentTimeStr) return true;
            return false;
          });

          if (validExam) {
            nextExam = validExam as unknown as { id: string; exam_date: string };
          }
        } else {
          console.warn('Nenhuma data de exame encontrada ou erro ao buscar:', examError);
        }
      }

      const allowSourceFallback = hasSources && (!!sourcesError || sourcesLoading);

      const validAdditionalPhones = (sanitizedFormData.additionalPhones || []).filter(phone => {
        if (!phone) return false;
        const digitsOnly = phone.replace(/\D/g, '');
        return digitsOnly.length === 10 || digitsOnly.length === 11;
      });

      const { data: registerResult, error } = await supabase.rpc('register_student', {
        p_payload: {
          student_name: sanitizedFormData.studentName,
          responsible_name: sanitizedFormData.responsibleName,
          responsible_cpf: null,
          birth_date: null,
          phone: sanitizedFormData.phone,
          email: sanitizedFormData.email,
          city: null,
          neighborhood: sanitizedFormData.neighborhood,
          origin_school: '',
          class_id: sanitizedFormData.classId,
          unit_id: sanitizedFormData.unitId,
          registration_source_id: hasSources && !allowSourceFallback && sanitizedFormData.registrationSourceId
            ? sanitizedFormData.registrationSourceId
            : null,
          tracking_code: activeTrackingCode,
          status: selectedClass?.has_exam ? 'nao_confirmado' : 'nenhum_agendamento',
          exam_date_id: nextExam?.id ?? null,
          exam_date: nextExam?.exam_date ?? null,
          additional_phones: validAdditionalPhones,
          website: websiteHoneypot,
        },
      });

      if (error) throw error;

      const result = registerResult as { success?: boolean; id?: string; registration_token?: string; error?: string };
      if (!result?.success || !result.id || !result.registration_token) {
        throw new Error(result?.error || 'Erro ao registrar inscrição');
      }

      storeRegistrationToken(result.id, result.registration_token);

      toast.success('Inscrição realizada com sucesso!');

      navigate('/confirmacao', {
        state: {
          classId: formData.classId,
          unitId: formData.unitId,
          studentId: result.id,
          registrationToken: result.registration_token,
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

  const formCard = (content: ReactNode) => (
    <RegistrationLandingLayout unitName={preSelectedUnit?.name}>
      {content}
    </RegistrationLandingLayout>
  );

  const formBody = (
    <>
      <div className={`border-b border-slate-100 bg-slate-50/80 px-6 py-4 ${montserrat}`}>
        <h2 className="text-center text-lg font-bold text-primary sm:text-xl">
          Inscrição de Candidatos
        </h2>
      </div>
      <div className={`px-6 py-6 ${montserrat}`}>
        <input
          type="text"
          name="website"
          value={websiteHoneypot}
          onChange={(e) => setWebsiteHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
        />
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
            className="w-full bg-[#ffac1a] text-white hover:bg-[#e89b0f]"
            disabled={loading || dataLoading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Realizando Inscrição...
              </>
            ) : (
              'Realizar Inscrição'
            )}
          </Button>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-gray-800">
            <p>
              Caso possua mais de 1 filho(a), conclua a inscrição do primeiro e após haverá a opção
              para a inscrição do próximo.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              As informações coletadas serão utilizadas exclusivamente para fins de inscrição e
              comunicação sobre o Processo de Admissão 2027.
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Ao enviar este formulário, você concorda com o uso dos seus dados para comunicação sobre
            o Processo de Admissão 2027, conforme nossa{' '}
            <a
              href="/privacidade"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Política de Privacidade
            </a>
            .
          </p>
        </form>
      </div>
    </>
  );

  // Mostrar loading enquanto carrega dados iniciais
  if (dataLoading) {
    return formCard(
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando dados do formulário...</p>
      </div>,
    );
  }

  // Mostrar erro se houver problema no carregamento
  if (dataError) {
    return formCard(
      <div className="px-6 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Erro ao carregar dados: {dataError}</span>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>,
    );
  }

  return formCard(formBody);
};