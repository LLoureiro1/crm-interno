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
    cityName: '',
    neighborhood: '',
    originSchool: '',
    seriesId: '',
    classId: '',
    unitId: ''
  });

  const [cities, setCities] = useState<City[]>([]);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [series, setSeries] = useState<Serie[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    // Limpar erro do campo quando ele for alterado
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCitySearch = (value: string) => {
    setFormData(prev => ({ ...prev, cityName: value, cityId: '' }));
    
    // Limpar erro do campo cidade
    if (fieldErrors.cityId) {
      setFieldErrors(prev => ({ ...prev, cityId: '' }));
    }
    
    if (value.length >= 3) {
      const filtered = cities.filter(city => 
        city.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCities(filtered);
      setShowCityDropdown(true);
    } else {
      setShowCityDropdown(false);
      setFilteredCities([]);
    }
  };

  const selectCity = (city: City) => {
    setFormData(prev => ({ ...prev, cityId: city.id, cityName: city.name }));
    setShowCityDropdown(false);
    // Limpar erro do campo cidade
    if (fieldErrors.cityId) {
      setFieldErrors(prev => ({ ...prev, cityId: '' }));
    }
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
    const errors: Record<string, string> = {};
    
    // Validar campos obrigatórios
    if (!formData.studentName.trim()) {
      errors.studentName = 'Nome do aluno é obrigatório';
    }
    
    if (!formData.responsibleName.trim()) {
      errors.responsibleName = 'Nome do responsável é obrigatório';
    }
    
    if (!formData.birthDate || formData.birthDate.length !== 10) {
      errors.birthDate = 'Data de nascimento válida é obrigatória (DD/MM/YYYY)';
    }
    
    if (!formData.phone || formData.phone.replace(/\D/g, '').length !== 11) {
      errors.phone = 'Telefone válido é obrigatório (11 dígitos com DDD)';
    }
    
    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'E-mail deve ter um formato válido';
    }
    
    if (!formData.cityId) {
      errors.cityId = 'Cidade é obrigatória - digite pelo menos 3 letras e selecione uma opção';
    }
    
    if (!formData.neighborhood.trim()) {
      errors.neighborhood = 'Bairro é obrigatório';
    }
    
    if (!formData.originSchool.trim()) {
      errors.originSchool = 'Escola de origem é obrigatória';
    }
    
    if (!formData.seriesId) {
      errors.seriesId = 'Série é obrigatória';
    }
    
    if (!formData.classId) {
      errors.classId = 'Turma é obrigatória';
    }

    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast.error('Por favor, corrija os campos destacados em vermelho');
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
              {/* Dados do Aluno */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Dados do Aluno</h3>
                
                <div>
                  <Label htmlFor="studentName" className={fieldErrors.studentName ? 'text-red-600' : ''}>
                    Nome Completo do Aluno *
                  </Label>
                  <Input
                    id="studentName"
                    value={formData.studentName}
                    onChange={(e) => handleInputChange('studentName', e.target.value)}
                    placeholder="Digite o nome completo do aluno"
                    className={fieldErrors.studentName ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.studentName && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.studentName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="birthDate" className={fieldErrors.birthDate ? 'text-red-600' : ''}>
                    Data de Nascimento *
                  </Label>
                  <Input
                    id="birthDate"
                    value={formData.birthDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className={fieldErrors.birthDate ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.birthDate && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.birthDate}</p>
                  )}
                </div>
              </div>

              {/* Dados do Responsável */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Dados do Responsável</h3>
                
                <div>
                  <Label htmlFor="responsibleName" className={fieldErrors.responsibleName ? 'text-red-600' : ''}>
                    Nome Completo do Responsável *
                  </Label>
                  <Input
                    id="responsibleName"
                    value={formData.responsibleName}
                    onChange={(e) => handleInputChange('responsibleName', e.target.value)}
                    placeholder="Digite o nome completo do responsável"
                    className={fieldErrors.responsibleName ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.responsibleName && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.responsibleName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone" className={fieldErrors.phone ? 'text-red-600' : ''}>
                    Telefone *
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(XX) XXXXX-XXXX"
                    maxLength={15}
                    className={fieldErrors.phone ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.phone && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className={fieldErrors.email ? 'text-red-600' : ''}>
                    E-mail *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@exemplo.com"
                    className={fieldErrors.email ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.email && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.email}</p>
                  )}
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Endereço</h3>
                
                <div className="relative">
                  <Label htmlFor="city" className={fieldErrors.cityId ? 'text-red-600' : ''}>
                    Cidade *
                  </Label>
                  <Input
                    id="city"
                    value={formData.cityName}
                    onChange={(e) => handleCitySearch(e.target.value)}
                    placeholder="Digite pelo menos 3 letras da cidade"
                    className={fieldErrors.cityId ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.cityId && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.cityId}</p>
                  )}
                  {showCityDropdown && filteredCities.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredCities.map((city) => (
                        <div
                          key={city.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => selectCity(city)}
                        >
                          {city.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {showCityDropdown && filteredCities.length === 0 && formData.cityName.length >= 3 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                      <div className="px-4 py-2 text-gray-500">
                        Nenhuma cidade encontrada
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="neighborhood" className={fieldErrors.neighborhood ? 'text-red-600' : ''}>
                    Bairro *
                  </Label>
                  <Input
                    id="neighborhood"
                    value={formData.neighborhood}
                    onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                    placeholder="Digite o bairro"
                    className={fieldErrors.neighborhood ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.neighborhood && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.neighborhood}</p>
                  )}
                </div>
              </div>

              {/* Dados Acadêmicos */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Dados Acadêmicos</h3>
                
                <div>
                  <Label htmlFor="originSchool" className={fieldErrors.originSchool ? 'text-red-600' : ''}>
                    Escola de Origem *
                  </Label>
                  <Input
                    id="originSchool"
                    value={formData.originSchool}
                    onChange={(e) => handleInputChange('originSchool', e.target.value)}
                    placeholder="Digite a escola de origem"
                    className={fieldErrors.originSchool ? 'border-red-500 focus:border-red-500' : ''}
                    required
                  />
                  {fieldErrors.originSchool && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.originSchool}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="series" className={fieldErrors.seriesId ? 'text-red-600' : ''}>
                    Série *
                  </Label>
                  <Select value={formData.seriesId} onValueChange={(value) => handleInputChange('seriesId', value)}>
                    <SelectTrigger className={fieldErrors.seriesId ? 'border-red-500 focus:border-red-500' : ''}>
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
                  {fieldErrors.seriesId && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.seriesId}</p>
                  )}
                </div>

                {formData.seriesId && (
                  <div>
                    <Label htmlFor="unit">Unidade</Label>
                    <Select value={formData.unitId} onValueChange={(value) => handleInputChange('unitId', value === 'none' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma unidade específica</SelectItem>
                        {availableUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(formData.unitId || formData.seriesId) && (
                  <div>
                    <Label htmlFor="class" className={fieldErrors.classId ? 'text-red-600' : ''}>
                      Turma *
                    </Label>
                    <Select value={formData.classId} onValueChange={(value) => handleInputChange('classId', value)}>
                      <SelectTrigger className={fieldErrors.classId ? 'border-red-500 focus:border-red-500' : ''}>
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
                    {fieldErrors.classId && (
                      <p className="text-red-600 text-sm mt-1">{fieldErrors.classId}</p>
                    )}
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
