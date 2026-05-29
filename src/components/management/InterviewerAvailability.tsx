import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, Clock, Plus, Trash2, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateForDisplay, formatTimeForDisplay, getCurrentDate } from '@/utils/dateUtils';
import type { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SpecificAvailability = Tables<'interviewer_availability'> & {
  class_ids?: string[] | null;
  profiles: Tables<'profiles'>;
  units: Tables<'units'> | null;
};

interface RecurrentAvailability {
  id: string;
  interviewer_id: string;
  unit_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  class_ids: string[] | null;
  created_at: string;
  profiles?: Tables<'profiles'>;
  units?: Tables<'units'> | null;
}

interface AvailabilityExclusion {
  id: string;
  unit_id: string | null;
  interviewer_id: string | null;
  exclusion_date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  profiles?: Tables<'profiles'> | null;
  units?: Tables<'units'> | null;
}

type Unit = Tables<'units'>;
type Class = Tables<'classes'> & {
  series: Tables<'series'>;
};

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
];

export const InterviewerAvailability = () => {
  const [activeTab, setActiveTab] = useState<'specific' | 'recurrent' | 'exclusions'>('specific');
  
  // Data States
  const [availabilities, setAvailabilities] = useState<SpecificAvailability[]>([]);
  const [recurrentAvailabilities, setRecurrentAvailabilities] = useState<RecurrentAvailability[]>([]);
  const [exclusions, setExclusions] = useState<AvailabilityExclusion[]>([]);
  
  const [interviewers, setInterviewers] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Form toggles
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [specificFormData, setSpecificFormData] = useState({
    interviewerId: '',
    date: '',
    startTime: '',
    endTime: '',
    unitId: '',
    classIds: [] as string[]
  });

  const [recurrentFormData, setRecurrentFormData] = useState({
    interviewerId: '',
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    unitId: '',
    classIds: [] as string[]
  });

  const [exclusionFormData, setExclusionFormData] = useState({
    unitId: 'all', // 'all' map to null
    interviewerId: 'all', // 'all' map to null
    exclusionDate: '',
    startTime: '',
    endTime: '',
    allDay: true
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    fetchAvailabilities();
    fetchRecurrentAvailabilities();
    fetchExclusions();
    fetchInterviewers();
    fetchUnits();
    fetchClasses();
  };

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    if (data) setUnits(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*, series(*)').order('name');
    if (data) setClasses(data);
  };

  const fetchInterviewers = async () => {
    const { data } = await supabase
      .from('staff_directory')
      .select('*')
      .in('profile', ['entrevistador', 'direcao', 'admin'])
      .eq('ativo', true)
      .neq('profile', 'padrao');

    if (data) {
      const sorted = [...data].sort((a, b) => {
        const nameA = a.name?.toLowerCase() || '';
        const nameB = b.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB, 'pt-BR');
      });
      setInterviewers(sorted);
    }
  };

  // 1) Specific Availabilities Operations
  const fetchAvailabilities = async () => {
    const { data, error } = await supabase
      .from('interviewer_availability')
      .select(`
        *,
        profiles!interviewer_availability_interviewer_id_fkey(name),
        units(*)
      `)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching specific availabilities:', error);
      return;
    }
    setAvailabilities((data as unknown as SpecificAvailability[]) || []);
  };

  const handleSpecificSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specificFormData.interviewerId || !specificFormData.date || !specificFormData.startTime || !specificFormData.endTime || !specificFormData.unitId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (specificFormData.date < getCurrentDate()) {
      toast.error('A data não pode ser no passado');
      return;
    }
    if (specificFormData.startTime >= specificFormData.endTime) {
      toast.error('Horário de início deve ser anterior ao horário de fim');
      return;
    }

    try {
      const { error } = await supabase
        .from('interviewer_availability')
        .insert({
          interviewer_id: specificFormData.interviewerId,
          date: specificFormData.date,
          start_time: specificFormData.startTime,
          end_time: specificFormData.endTime,
          unit_id: specificFormData.unitId,
          class_ids: specificFormData.classIds.length > 0 ? specificFormData.classIds : null
        } as any);

      if (error) throw error;
      toast.success('Disponibilidade avulsa adicionada com sucesso');
      setSpecificFormData({
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
      console.error('Error adding specific availability:', error);
      toast.error('Erro ao adicionar disponibilidade avulsa');
    }
  };

  const handleSpecificDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('interviewer_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Disponibilidade avulsa removida com sucesso');
      fetchAvailabilities();
    } catch (error) {
      console.error('Error deleting specific availability:', error);
      toast.error('Erro ao remover disponibilidade avulsa');
    }
  };

  // 2) Recurrent Availabilities Operations
  const fetchRecurrentAvailabilities = async () => {
    const { data, error } = await supabase
      .from('interviewer_recurrent_availability' as any)
      .select(`
        *,
        profiles:interviewer_id(name),
        units:unit_id(*)
      `)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching recurrent availabilities:', error);
      return;
    }
    setRecurrentAvailabilities((data as unknown as RecurrentAvailability[]) || []);
  };

  const handleRecurrentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurrentFormData.interviewerId || recurrentFormData.dayOfWeek === '' || !recurrentFormData.startTime || !recurrentFormData.endTime || !recurrentFormData.unitId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (recurrentFormData.startTime >= recurrentFormData.endTime) {
      toast.error('Horário de início deve ser anterior ao horário de fim');
      return;
    }

    try {
      const { error } = await supabase
        .from('interviewer_recurrent_availability' as any)
        .insert({
          interviewer_id: recurrentFormData.interviewerId,
          day_of_week: parseInt(recurrentFormData.dayOfWeek),
          start_time: recurrentFormData.startTime,
          end_time: recurrentFormData.endTime,
          unit_id: recurrentFormData.unitId,
          class_ids: recurrentFormData.classIds.length > 0 ? recurrentFormData.classIds : null
        });

      if (error) throw error;
      toast.success('Disponibilidade recorrente adicionada com sucesso');
      setRecurrentFormData({
        interviewerId: '',
        dayOfWeek: '',
        startTime: '',
        endTime: '',
        unitId: '',
        classIds: []
      });
      setShowAddForm(false);
      fetchRecurrentAvailabilities();
    } catch (error) {
      console.error('Error adding recurrent availability:', error);
      toast.error('Erro ao adicionar disponibilidade recorrente. Verifique se executou a migração SQL.');
    }
  };

  const handleRecurrentDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('interviewer_recurrent_availability' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Disponibilidade recorrente removida com sucesso');
      fetchRecurrentAvailabilities();
    } catch (error) {
      console.error('Error deleting recurrent availability:', error);
      toast.error('Erro ao remover disponibilidade recorrente');
    }
  };

  // 3) Exclusions Operations
  const fetchExclusions = async () => {
    const { data, error } = await supabase
      .from('availability_exclusions' as any)
      .select(`
        *,
        profiles:interviewer_id(name),
        units:unit_id(*)
      `)
      .order('exclusion_date', { ascending: true });

    if (error) {
      console.error('Error fetching exclusions:', error);
      return;
    }
    setExclusions((data as unknown as AvailabilityExclusion[]) || []);
  };

  const handleExclusionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exclusionFormData.exclusionDate) {
      toast.error('Preencha a data da exclusão');
      return;
    }
    if (!exclusionFormData.allDay && (!exclusionFormData.startTime || !exclusionFormData.endTime)) {
      toast.error('Preencha os horários de início e fim da exclusão');
      return;
    }
    if (!exclusionFormData.allDay && exclusionFormData.startTime >= exclusionFormData.endTime) {
      toast.error('Horário de início deve ser anterior ao horário de fim');
      return;
    }

    try {
      const { error } = await supabase
        .from('availability_exclusions' as any)
        .insert({
          exclusion_date: exclusionFormData.exclusionDate,
          unit_id: exclusionFormData.unitId === 'all' ? null : exclusionFormData.unitId,
          interviewer_id: exclusionFormData.interviewerId === 'all' ? null : exclusionFormData.interviewerId,
          start_time: exclusionFormData.allDay ? null : exclusionFormData.startTime,
          end_time: exclusionFormData.allDay ? null : exclusionFormData.endTime
        });

      if (error) throw error;
      toast.success('Exclusão de agenda adicionada com sucesso');
      setExclusionFormData({
        unitId: 'all',
        interviewerId: 'all',
        exclusionDate: '',
        startTime: '',
        endTime: '',
        allDay: true
      });
      setShowAddForm(false);
      fetchExclusions();
    } catch (error) {
      console.error('Error adding exclusion:', error);
      toast.error('Erro ao adicionar exclusão. Verifique se executou a migração SQL e se possui acesso.');
    }
  };

  const handleExclusionDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('availability_exclusions' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Exclusão de agenda removida com sucesso');
      fetchExclusions();
    } catch (error) {
      console.error('Error deleting exclusion:', error);
      toast.error('Erro ao remover exclusão');
    }
  };

  // Helper unit filter
  const filterAvailableUnits = async (interviewerId: string) => {
    if (!interviewerId) {
      setAvailableUnits([]);
      return;
    }
    const { data: profile } = await supabase.from('staff_directory').select('unit_id').eq('id', interviewerId).single();
    if (!profile?.unit_id) {
      setAvailableUnits(units);
      return;
    }
    const { data: unit } = await supabase.from('units').select('slug').eq('id', profile.unit_id).single();
    if ((unit as any)?.slug === 'central') {
      setAvailableUnits(units);
    } else {
      setAvailableUnits(units.filter(u => u.id === profile.unit_id));
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val as any);
        setShowAddForm(false);
      }} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-xl mb-4">
          <TabsTrigger value="specific">Horários Avulsos</TabsTrigger>
          <TabsTrigger value="recurrent">Horários Recorrentes</TabsTrigger>
          <TabsTrigger value="exclusions">Bloqueios & Exclusões</TabsTrigger>
        </TabsList>

        <div className="flex justify-between items-center mb-4">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar {activeTab === 'specific' ? 'Disponibilidade Avulsa' : activeTab === 'recurrent' ? 'Disponibilidade Recorrente' : 'Bloqueio de Agenda'}
          </Button>
        </div>

        {/* --- TABS CONTENT: SPECIFIC --- */}
        <TabsContent value="specific" className="space-y-6">
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Disponibilidade Avulsa</CardTitle>
                <CardDescription>Cadastre um horário de atendimento específico para uma data única.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSpecificSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="specific_interviewer">Entrevistador *</Label>
                      <Select
                        value={specificFormData.interviewerId}
                        onValueChange={(val) => {
                          setSpecificFormData(prev => ({ ...prev, interviewerId: val, unitId: '' }));
                          filterAvailableUnits(val);
                        }}
                      >
                        <SelectTrigger id="specific_interviewer">
                          <SelectValue placeholder="Selecione o entrevistador" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          {interviewers.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="specific_date">Data *</Label>
                      <Input
                        id="specific_date"
                        type="date"
                        value={specificFormData.date}
                        min={getCurrentDate()}
                        onChange={(e) => setSpecificFormData(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="specific_start">Horário de Início *</Label>
                      <Input
                        id="specific_start"
                        type="time"
                        value={specificFormData.startTime}
                        onChange={(e) => setSpecificFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="specific_end">Horário de Fim *</Label>
                      <Input
                        id="specific_end"
                        type="time"
                        value={specificFormData.endTime}
                        onChange={(e) => setSpecificFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="specific_unit">Unidade *</Label>
                      <Select
                        value={specificFormData.unitId}
                        onValueChange={(val) => setSpecificFormData(prev => ({ ...prev, unitId: val, classIds: [] }))}
                        disabled={!specificFormData.interviewerId}
                      >
                        <SelectTrigger id="specific_unit">
                          <SelectValue placeholder={specificFormData.interviewerId ? "Selecione a unidade" : "Selecione primeiro o entrevistador"} />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          {availableUnits.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {specificFormData.unitId && (
                      <div className="md:col-span-2">
                        <Label className="mb-2 block">Turmas (Opcional)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-4 rounded-md max-h-40 overflow-y-auto bg-white">
                          {classes.filter(c => c.unit_id === specificFormData.unitId).map((cls) => (
                            <div key={cls.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`s-class-${cls.id}`}
                                checked={specificFormData.classIds.includes(cls.id)}
                                onCheckedChange={(chk) => {
                                  setSpecificFormData(prev => ({
                                    ...prev,
                                    classIds: chk ? [...prev.classIds, cls.id] : prev.classIds.filter(id => id !== cls.id)
                                  }));
                                }}
                              />
                              <Label htmlFor={`s-class-${cls.id}`} className="text-sm font-normal cursor-pointer">
                                {cls.name} ({cls.series?.name})
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Salvar Disponibilidade</Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Disponibilidades Avulsas Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {availabilities.length > 0 ? (
                  availabilities.map((avail) => (
                    <div key={avail.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="font-semibold text-gray-800">{avail.profiles?.name}</span>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Calendar className="h-4 w-4 text-orange-500" />
                          <span>{formatDateForDisplay(avail.date)}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span>{formatTimeForDisplay(avail.start_time)} - {formatTimeForDisplay(avail.end_time)}</span>
                        </div>
                        {avail.units && (
                          <Badge variant="secondary">{avail.units.name}</Badge>
                        )}
                        {(avail as any).class_ids && (avail as any).class_ids.length > 0 && (
                          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">{(avail as any).class_ids.length} turmas</Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleSpecificDelete(avail.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-6">Nenhuma disponibilidade avulsa cadastrada.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TABS CONTENT: RECURRENT --- */}
        <TabsContent value="recurrent" className="space-y-6">
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Disponibilidade Recorrente</CardTitle>
                <CardDescription>Cadastre horários de atendimento que se repetem automaticamente toda semana.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRecurrentSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="recurrent_interviewer">Entrevistador *</Label>
                      <Select
                        value={recurrentFormData.interviewerId}
                        onValueChange={(val) => {
                          setRecurrentFormData(prev => ({ ...prev, interviewerId: val, unitId: '' }));
                          filterAvailableUnits(val);
                        }}
                      >
                        <SelectTrigger id="recurrent_interviewer">
                          <SelectValue placeholder="Selecione o entrevistador" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          {interviewers.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="recurrent_day">Dia da Semana *</Label>
                      <Select
                        value={recurrentFormData.dayOfWeek}
                        onValueChange={(val) => setRecurrentFormData(prev => ({ ...prev, dayOfWeek: val }))}
                      >
                        <SelectTrigger id="recurrent_day">
                          <SelectValue placeholder="Selecione o dia da semana" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          {WEEKDAYS.map((d) => (
                            <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="recurrent_start">Horário de Início *</Label>
                      <Input
                        id="recurrent_start"
                        type="time"
                        value={recurrentFormData.startTime}
                        onChange={(e) => setRecurrentFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="recurrent_end">Horário de Fim *</Label>
                      <Input
                        id="recurrent_end"
                        type="time"
                        value={recurrentFormData.endTime}
                        onChange={(e) => setRecurrentFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="recurrent_unit">Unidade *</Label>
                      <Select
                        value={recurrentFormData.unitId}
                        onValueChange={(val) => setRecurrentFormData(prev => ({ ...prev, unitId: val, classIds: [] }))}
                        disabled={!recurrentFormData.interviewerId}
                      >
                        <SelectTrigger id="recurrent_unit">
                          <SelectValue placeholder={recurrentFormData.interviewerId ? "Selecione a unidade" : "Selecione primeiro o entrevistador"} />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          {availableUnits.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {recurrentFormData.unitId && (
                      <div className="md:col-span-2">
                        <Label className="mb-2 block">Turmas (Opcional)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-4 rounded-md max-h-40 overflow-y-auto bg-white">
                          {classes.filter(c => c.unit_id === recurrentFormData.unitId).map((cls) => (
                            <div key={cls.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`r-class-${cls.id}`}
                                checked={recurrentFormData.classIds.includes(cls.id)}
                                onCheckedChange={(chk) => {
                                  setRecurrentFormData(prev => ({
                                    ...prev,
                                    classIds: chk ? [...prev.classIds, cls.id] : prev.classIds.filter(id => id !== cls.id)
                                  }));
                                }}
                              />
                              <Label htmlFor={`r-class-${cls.id}`} className="text-sm font-normal cursor-pointer">
                                {cls.name} ({cls.series?.name})
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Salvar Disponibilidade Recorrente</Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Disponibilidades Recorrentes Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recurrentAvailabilities.length > 0 ? (
                  recurrentAvailabilities.map((avail) => (
                    <div key={avail.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="font-semibold text-gray-800">{avail.profiles?.name}</span>
                        <div className="flex items-center space-x-1 text-sm text-gray-600 bg-orange-50 text-orange-800 px-2 py-1 rounded">
                          <span>{WEEKDAYS.find(w => w.value === avail.day_of_week)?.label}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span>{formatTimeForDisplay(avail.start_time)} - {formatTimeForDisplay(avail.end_time)}</span>
                        </div>
                        {avail.units && (
                          <Badge variant="secondary">{avail.units.name}</Badge>
                        )}
                        {avail.class_ids && avail.class_ids.length > 0 && (
                          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">{avail.class_ids.length} turmas</Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRecurrentDelete(avail.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-6">Nenhuma disponibilidade recorrente cadastrada.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TABS CONTENT: EXCLUSIONS --- */}
        <TabsContent value="exclusions" className="space-y-6">
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>Bloqueio ou Exclusão de Agenda</CardTitle>
                <CardDescription>
                  Impeça o agendamento de entrevistas em feriados, recessos ou horários de ausência.
                  Exclusões específicas sempre se sobrepõem e cancelam a disponibilidade (tanto avulsa quanto recorrente).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleExclusionSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="exclusion_date">Data do Bloqueio *</Label>
                      <Input
                        id="exclusion_date"
                        type="date"
                        value={exclusionFormData.exclusionDate}
                        min={getCurrentDate()}
                        onChange={(e) => setExclusionFormData(prev => ({ ...prev, exclusionDate: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="exclusion_unit">Unidade (opcional)</Label>
                      <Select
                        value={exclusionFormData.unitId}
                        onValueChange={(val) => setExclusionFormData(prev => ({ ...prev, unitId: val }))}
                      >
                        <SelectTrigger id="exclusion_unit">
                          <SelectValue placeholder="Todas as unidades (global)" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          <SelectItem value="all">Todas as unidades (global)</SelectItem>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="exclusion_interviewer">Entrevistador (opcional)</Label>
                      <Select
                        value={exclusionFormData.interviewerId}
                        onValueChange={(val) => setExclusionFormData(prev => ({ ...prev, interviewerId: val }))}
                      >
                        <SelectTrigger id="exclusion_interviewer">
                          <SelectValue placeholder="Todos os entrevistadores" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          <SelectItem value="all">Todos os entrevistadores</SelectItem>
                          {interviewers.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2 mt-6">
                      <Checkbox
                        id="exclusion_all_day"
                        checked={exclusionFormData.allDay}
                        onCheckedChange={(chk) => setExclusionFormData(prev => ({ ...prev, allDay: !!chk }))}
                      />
                      <Label htmlFor="exclusion_all_day" className="cursor-pointer">Bloquear o dia inteiro</Label>
                    </div>

                    {!exclusionFormData.allDay && (
                      <>
                        <div>
                          <Label htmlFor="exclusion_start">Horário de Início *</Label>
                          <Input
                            id="exclusion_start"
                            type="time"
                            value={exclusionFormData.startTime}
                            onChange={(e) => setExclusionFormData(prev => ({ ...prev, startTime: e.target.value }))}
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="exclusion_end">Horário de Fim *</Label>
                          <Input
                            id="exclusion_end"
                            type="time"
                            value={exclusionFormData.endTime}
                            onChange={(e) => setExclusionFormData(prev => ({ ...prev, endTime: e.target.value }))}
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Salvar Bloqueio</Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Bloqueios e Exclusões Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {exclusions.length > 0 ? (
                  exclusions.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center space-x-1 text-sm font-semibold text-red-600">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDateForDisplay(ex.exclusion_date)}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>
                            {ex.start_time && ex.end_time 
                              ? `${formatTimeForDisplay(ex.start_time)} - ${formatTimeForDisplay(ex.end_time)}`
                              : 'Dia inteiro'}
                          </span>
                        </div>
                        <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                          Bloqueado
                        </Badge>
                        <div>
                          <span className="text-xs text-gray-500 block">
                            Entrevistador: {ex.profiles?.name || 'Todos'}
                          </span>
                          <span className="text-xs text-gray-500 block">
                            Unidade: {ex.units?.name || 'Todas (Global)'}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleExclusionDelete(ex.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-6">Nenhum bloqueio cadastrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
