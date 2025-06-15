
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

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
    unit_id: ''
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.exam_date || !formData.exam_time || !formData.unit_id) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      const { error } = await supabase
        .from('exam_dates')
        .insert({
          exam_date: formData.exam_date,
          exam_time: formData.exam_time,
          unit_id: formData.unit_id
        });

      if (error) throw error;

      toast.success('Data de prova cadastrada com sucesso');
      setFormData({ exam_date: '', exam_time: '', unit_id: '' });
      fetchExamDates();
    } catch (error) {
      console.error('Error creating exam date:', error);
      toast.error('Erro ao cadastrar data de prova');
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="exam_date">Data da Prova</Label>
                <Input
                  id="exam_date"
                  type="date"
                  value={formData.exam_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, exam_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="exam_time">Horário</Label>
                <Input
                  id="exam_time"
                  type="time"
                  value={formData.exam_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, exam_time: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="unit_id">Unidade</Label>
                <Select
                  value={formData.unit_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Data
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
                        <span>{new Date(examDate.exam_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{examDate.exam_time}</span>
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
