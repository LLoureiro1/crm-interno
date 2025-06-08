
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type City = Tables<'cities'>;
type Unit = Tables<'units'>;
type Serie = Tables<'series'>;
type Class = Tables<'classes'> & {
  series: Serie;
  units: Unit;
};

export const RegistrationForm = () => {
  const [formData, setFormData] = useState({
    studentName: '',
    responsibleName: '',
    birthDate: '',
    phone: '',
    email: '',
    cityId: '',
    neighborhood: '',
    originSchool: '',
    seriesId: '',
    classId: '',
    unitId: ''
  });

  const [cities, setCities] = useState<City[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

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

  const loadInitialData = async () => {
    try {
      // Carregar cidades
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .order('name');

      if (citiesError) throw citiesError;
      setCities(citiesData || []);

      // Carregar séries
      const { data: seriesData, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .order('name');

      if (seriesError) throw seriesError;
      setSeries(seriesData || []);

      // Carregar turmas com relacionamentos
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          series (*),
          units (*)
        `)
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      toast.error('Erro ao carregar dados do formulário');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatPhone = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a máscara (XX) XXXXX-XXXX
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    handleInputChange('phone', formatted);
  };

  const formatDate = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a máscara DD/MM/YYYY
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const handleDateChange = (value: string) => {
    const formatted = formatDate(value);
    handleInputChange('birthDate', formatted);
  };

  const validateForm = () => {
    const required = [
      'studentName', 'responsibleName', 'birthDate', 'phone', 
      'email', 'cityId', 'neighborhood', 'originSchool', 'classId'
    ];

    for (const field of required) {
      if (!formData[field as keyof typeof formData]) {
        toast.error('Todos os campos obrigatórios devem ser preenchidos');
        return false;
      }
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor, insira um email válido');
      return false;
    }

    // Validar formato da data
    if (formData.birthDate.length !== 10) {
      toast.error('Por favor, insira uma data válida (DD/MM/YYYY)');
      return false;
    }

    // Validar formato do telefone
    if (formData.phone.replace(/\D/g, '').length !== 11) {
      toast.error('Por favor, insira um telefone válido com DDD (11 dígitos)');
      return false;
    }

    return true;
  };

  const convertDateToISO = (dateStr: string) => {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const selectedClass = availableClasses.find(cls => cls.id === formData.classId);
      
      const studentData = {
        student_name: formData.studentName,
        responsible_name: formData.responsibleName,
        birth_date: convertDateToISO(formData.birthDate),
        phone: formData.phone,
        email: formData.email,
        city_id: formData.cityId,
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
        neighborhood: '',
        originSchool: '',
        seriesId: '',
        classId: '',
        unitId: ''
      });

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
              {/* Dados do Aluno */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Dados do Aluno</h3>
                
                <div>
                  <Label htmlFor="studentName">Nome Completo do Aluno *</Label>
                  <Input
                    id="studentName"
                    value={formData.studentName}
                    onChange={(e) => handleInputChange('studentName', e.target.value)}
                    placeholder="Digite o nome completo do aluno"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="birthDate">Data de Nascimento *</Label>
                  <Input
                    id="birthDate"
                    value={formData.birthDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    required
                  />
                </div>
              </div>

              {/* Dados do Responsável */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Dados do Responsável</h3>
                
                <div>
                  <Label htmlFor="responsibleName">Nome Completo do Responsável *</Label>
                  <Input
                    id="responsibleName"
                    value={formData.responsibleName}
                    onChange={(e) => handleInputChange('responsibleName', e.target.value)}
                    placeholder="Digite o nome completo do responsável"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(XX) XXXXX-XXXX"
                    maxLength={15}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Endereço</h3>
                
                <div>
                  <Label htmlFor="city">Cidade *</Label>
                  <Select value={formData.cityId} onValueChange={(value) => handleInputChange('cityId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a cidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input
                    id="neighborhood"
                    value={formData.neighborhood}
                    onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                    placeholder="Digite o bairro"
                    required
                  />
                </div>
              </div>

              {/* Dados Acadêmicos */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Dados Acadêmicos</h3>
                
                <div>
                  <Label htmlFor="originSchool">Escola de Origem *</Label>
                  <Input
                    id="originSchool"
                    value={formData.originSchool}
                    onChange={(e) => handleInputChange('originSchool', e.target.value)}
                    placeholder="Digite a escola de origem"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="series">Série *</Label>
                  <Select value={formData.seriesId} onValueChange={(value) => handleInputChange('seriesId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a série" />
                    </SelectTrigger>
                    <SelectContent>
                      {series.map((serie) => (
                        <SelectItem key={serie.id} value={serie.id}>
                          {serie.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.seriesId && (
                  <div>
                    <Label htmlFor="unit">Unidade *</Label>
                    <Select value={formData.unitId} onValueChange={(value) => handleInputChange('unitId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.unitId && (
                  <div>
                    <Label htmlFor="class">Turma *</Label>
                    <Select value={formData.classId} onValueChange={(value) => handleInputChange('classId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

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
