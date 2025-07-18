
import { useState, useEffect } from 'react';
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
import { RegistrationFormData, ValidationErrors } from '@/types/registration';
import type { Tables } from '@/integrations/supabase/types';

type Unit = Tables<'units'>;
type Serie = Tables<'series'>;
type Class = Tables<'classes'> & {
  series: Serie;
  units: Unit;
};

export const RegistrationForm = () => {
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
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});

  const { series, classes } = useRegistrationData();

  // Filtrar turmas quando série é selecionada
  useEffect(() => {
    if (formData.seriesId) {
      const filteredClasses = classes.filter(cls => cls.series_id === formData.seriesId);
      setAvailableClasses(filteredClasses);
      
      // Extrair unidades únicas das turmas filtradas
      const uniqueUnits = filteredClasses
        .map(cls => cls.units)
        .filter((unit, index, arr) => arr.findIndex(u => u.id === unit.id) === index);
      setAvailableUnits(uniqueUnits);
      
      // Limpar seleções dependentes
      setFormData(prev => ({ ...prev, classId: '', unitId: '' }));
    } else {
      setAvailableClasses([]);
      setAvailableUnits([]);
    }
  }, [formData.seriesId, classes]);

  // Filtrar turmas quando unidade é selecionada
  useEffect(() => {
    if (formData.unitId && formData.seriesId) {
      const filteredClasses = classes.filter(
        cls => cls.series_id === formData.seriesId && cls.unit_id === formData.unitId
      );
      setAvailableClasses(filteredClasses);
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
    
    const errors = validateForm(formData);
    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast.error('Por favor, corrija os campos destacados em vermelho');
      return;
    }

    setLoading(true);

    try {
      const selectedClass = availableClasses.find(cls => cls.id === formData.classId);
      
      const studentData = {
        student_name: formData.studentName,
        responsible_name: formData.responsibleName,
        birth_date: convertDateToISO(formData.birthDate),
        phone: formData.phone,
        email: formData.email,
        city: formData.cityName,
        neighborhood: formData.neighborhood,
        origin_school: formData.originSchool,
        class_id: formData.classId,
        unit_id: selectedClass?.unit_id,
        status: selectedClass?.has_exam ? 'nao_confirmado' as const : 'nenhum_agendamento' as const
      };

      const { error } = await supabase
        .from('students')
        .insert(studentData);

      if (error) throw error;

      toast.success('Inscrição realizada com sucesso!');
      
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
                onInputChange={handleInputChange}
              />

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={loading}
              >
                {loading ? 'Realizando Inscrição...' : 'Realizar Inscrição'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
