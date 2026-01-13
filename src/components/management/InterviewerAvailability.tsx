
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Plus, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateForDisplay, formatTimeForDisplay } from '@/utils/dateUtils';
import type { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

type InterviewerAvailability = Tables<'interviewer_availability'> & {
  unit_id: string | null;
  class_ids: string[] | null;
  profiles: Tables<'profiles'>;
  units: Tables<'units'> | null;
};

type Unit = Tables<'units'>;
type Class = Tables<'classes'> & {
  series: Tables<'series'>;
};

export const InterviewerAvailability = () => {
  const [availabilities, setAvailabilities] = useState<InterviewerAvailability[]>([]);
  const [interviewers, setInterviewers] = useState<Tables<'profiles'>[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    interviewerId: '',
    date: '',
    startTime: '',
    endTime: '',
    unitId: '',
    classIds: [] as string[]
  });

  useEffect(() => {
    fetchAvailabilities();
    fetchInterviewers();
    fetchUnits();
    fetchClasses();
  }, []);

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    if (data) setUnits(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*, series(*)')
      .order('name');
    if (data) setClasses(data);
  };

  const fetchAvailabilities = async () => {
    const { data, error } = await supabase
      .from('interviewer_availability')
      .select(`
        *,
        profiles!interviewer_availability_interviewer_id_fkey(*),
        units(*)
      `)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching availabilities:', error);
      return;
    }

    setAvailabilities((data as unknown as InterviewerAvailability[]) || []);
  };

  const fetchInterviewers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('profile', ['entrevistador', 'direcao', 'admin']);

    if (data) setInterviewers(data);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClassToggle = (classId: string) => {
    setFormData(prev => {
      const current = prev.classIds;
      if (current.includes(classId)) {
        return { ...prev, classIds: current.filter(id => id !== classId) };
      } else {
        return { ...prev, classIds: [...current, classId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.interviewerId || !formData.date || !formData.startTime || !formData.endTime) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      toast.error('Horário de início deve ser anterior ao horário de fim');
      return;
    }

    try {
      const { error } = await supabase
        .from('interviewer_availability')
        .insert({
          interviewer_id: formData.interviewerId,
          date: formData.date,
          start_time: formData.startTime,
          end_time: formData.endTime,
          unit_id: (formData.unitId && formData.unitId !== 'all_units') ? formData.unitId : null,
          class_ids: formData.classIds.length > 0 ? formData.classIds : null
        } as any);

      if (error) throw error;

      toast.success('Disponibilidade adicionada com sucesso');
      setFormData({ 
        interviewerId: '', 
        date: '', 
        startTime: '', 
        endTime: '',
        unitId: '',
        classIds: []
      });
      setShowAddForm(false);
      fetchAvailabilities();
    } catch (error) {
      console.error('Error adding availability:', error);
      toast.error('Erro ao adicionar disponibilidade');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('interviewer_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Disponibilidade removida com sucesso');
      fetchAvailabilities();
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Erro ao remover disponibilidade');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Disponibilidade
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Disponibilidade</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interviewer">Entrevistador *</Label>
                  <Select
                    value={formData.interviewerId}
                    onValueChange={(value) => handleInputChange('interviewerId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o entrevistador" />
                    </SelectTrigger>
                    <SelectContent side="bottom">
                      {interviewers.map((interviewer) => (
                        <SelectItem key={interviewer.id} value={interviewer.id}>
                          {interviewer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="unit">Unidade (Opcional)</Label>
                  <Select
                    value={formData.unitId}
                    onValueChange={(value) => {
                      handleInputChange('unitId', value);
                      setFormData(prev => ({ ...prev, classIds: [] })); // Limpa turmas ao mudar unidade
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as unidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_units">Todas as unidades</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.unitId && formData.unitId !== 'all_units' && (
                  <div className="md:col-span-2">
                    <Label className="mb-2 block">Turmas (Opcional)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-4 rounded-md max-h-40 overflow-y-auto">
                      {classes
                        .filter(c => c.unit_id === formData.unitId)
                        .map((cls) => (
                          <div key={cls.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`class-${cls.id}`}
                              checked={formData.classIds.includes(cls.id)}
                              onCheckedChange={() => handleClassToggle(cls.id)}
                            />
                            <Label htmlFor={`class-${cls.id}`} className="text-sm font-normal cursor-pointer">
                              {cls.name} ({cls.series?.name})
                            </Label>
                          </div>
                        ))}
                      {classes.filter(c => c.unit_id === formData.unitId).length === 0 && (
                        <p className="text-sm text-gray-500 col-span-3">Nenhuma turma encontrada nesta unidade</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Se nenhuma turma for selecionada, a disponibilidade valerá para todas as turmas da unidade.</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="startTime">Horário de Início *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="endTime">Horário de Fim *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                  Salvar Disponibilidade
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Availabilities List */}
      <Card>
        <CardHeader>
          <CardTitle>Disponibilidades Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availabilities.length > 0 ? (
              availabilities.map((availability) => (
                <div key={availability.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {formatDateForDisplay(availability.date)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>
                        {formatTimeForDisplay(availability.start_time)} - {formatTimeForDisplay(availability.end_time)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">
                        {availability.profiles?.name}
                      </span>
                      {availability.units && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          {availability.units.name}
                        </span>
                      )}
                      {availability.class_ids && availability.class_ids.length > 0 && (
                        <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          {availability.class_ids.length} turmas
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(availability.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhuma disponibilidade cadastrada
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
