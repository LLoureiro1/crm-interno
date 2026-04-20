
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ExamDate = Tables<'exam_dates'> & {
  units: Tables<'units'>;
};

type Unit = Tables<'units'>;

export const ExamDateManagement = () => {
  const [examDates, setExamDates] = useState<ExamDate[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [formData, setFormData] = useState({
    exam_date: '',
    exam_time: '',
    selectedUnits: [] as string[]
  });

  useEffect(() => {
    fetchExamDates();
    fetchUnits();
  }, []);

  const fetchExamDates = async () => {
    const { data, error } = await supabase
      .from('exam_dates')
      .select(`
        *,
        units(*)
      `)
      .order('exam_date', { ascending: true });

    if (error) {
      console.error('Error fetching exam dates:', error);
      return;
    }

    setExamDates(data || []);
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching units:', error);
      return;
    }

    setUnits(data || []);
  };

  const handleUnitToggle = (unitId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedUnits: prev.selectedUnits.includes(unitId)
        ? prev.selectedUnits.filter(id => id !== unitId)
        : [...prev.selectedUnits, unitId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.exam_date || !formData.exam_time || formData.selectedUnits.length === 0) {
      toast.error('Preencha todos os campos e selecione pelo menos uma unidade');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.exam_date + 'T00:00:00');
    if (selectedDate < today) {
      toast.error('A data da prova não pode ser no passado');
      return;
    }

    try {
      // Criar uma data de prova para cada unidade selecionada
      const examDatesData = formData.selectedUnits.map(unitId => ({
        exam_date: formData.exam_date,
        exam_time: formData.exam_time,
        unit_id: unitId
      }));

      const { error } = await supabase
        .from('exam_dates')
        .insert(examDatesData);

      if (error) throw error;

      toast.success(`${examDatesData.length} data(s) de prova cadastrada(s) com sucesso`);
      setFormData({ exam_date: '', exam_time: '', selectedUnits: [] });
      fetchExamDates();
    } catch (error) {
      console.error('Error creating exam dates:', error);
      toast.error('Erro ao cadastrar datas de prova');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('exam_dates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Data de prova removida com sucesso');
      fetchExamDates();
    } catch (error) {
      console.error('Error deleting exam date:', error);
      toast.error('Erro ao remover data de prova');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Cadastrar Data de Prova</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exam_date">Data da Prova</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.exam_date ? (
                        format(new Date(formData.exam_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                      ) : (
                        <span>Escolha a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.exam_date ? new Date(formData.exam_date + 'T00:00:00') : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setFormData(prev => ({ ...prev, exam_date: `${year}-${month}-${day}` }));
                        }
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="exam_time">Horário</Label>
                <Select
                  value={formData.exam_time}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, exam_time: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o horário" />
                  </SelectTrigger>
                  <SelectContent side="bottom">
                    {Array.from({ length: 24 }, (_, hour) =>
                      [0, 30].map((minute) => {
                        const timeValue = `${hour.toString().padStart(2, '0')}:${minute
                          .toString()
                          .padStart(2, '0')}`;
                        return (
                          <SelectItem key={timeValue} value={timeValue}>
                            {timeValue}
                          </SelectItem>
                        );
                      })
                    ).flat()}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Unidades</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {units.map(unit => (
                  <div key={unit.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={unit.id}
                      checked={formData.selectedUnits.includes(unit.id)}
                      onCheckedChange={() => handleUnitToggle(unit.id)}
                    />
                    <Label
                      htmlFor={unit.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {unit.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Datas
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datas de Provas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {examDates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examDates.map((examDate) => (
                  <TableRow key={examDate.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{new Date(examDate.exam_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{examDate.exam_time.substring(0, 5)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{examDate.units.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(examDate.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Nenhuma data de prova cadastrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
