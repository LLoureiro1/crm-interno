
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Class = Tables<'classes'> & {
  series: { name: string };
  units: { name: string };
};
type Unit = Tables<'units'>;
type Series = Tables<'series'>;

export const ClassManagement = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    series_id: '',
    unit_id: '',
    has_exam: true,
    monthly_fee: '',
    annuity: '',
    parcelas: '',
    material_didatico_anual: ''
  });

  useEffect(() => {
    fetchClasses();
    fetchUnits();
    fetchSeries();
  }, []);

  // Calcular mensalidade automaticamente baseado na anuidade e parcelas
  useEffect(() => {
    if (formData.annuity && formData.parcelas) {
      const annuityValue = parseFloat(formData.annuity);
      const parcelasValue = parseInt(formData.parcelas);
      
      if (!isNaN(annuityValue) && !isNaN(parcelasValue) && parcelasValue > 0 && annuityValue > 0) {
        const mensalidadeCalculada = annuityValue / parcelasValue;
        setFormData(prev => ({ ...prev, monthly_fee: mensalidadeCalculada.toFixed(2) }));
      } else {
        // Limpar mensalidade se os valores não forem válidos
        setFormData(prev => ({ ...prev, monthly_fee: '' }));
      }
    } else {
      // Limpar mensalidade se algum campo estiver vazio
      setFormData(prev => ({ ...prev, monthly_fee: '' }));
    }
  }, [formData.annuity, formData.parcelas]);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        series (name),
        units (name)
      `)
      .order('name');

    if (error) {
      toast.error('Erro ao carregar turmas');
      return;
    }

    setClasses(data || []);
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar unidades');
      return;
    }

    setUnits(data || []);
  };

  const fetchSeries = async () => {
    const { data, error } = await supabase
      .from('series')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar séries');
      return;
    }

    setSeries(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const classData = {
        name: formData.name,
        series_id: formData.series_id,
        unit_id: formData.unit_id,
        has_exam: formData.has_exam,
        monthly_fee: parseFloat(formData.monthly_fee),
        annuity: parseFloat(formData.annuity),
        parcelas: parseInt(formData.parcelas),
        material_didatico_anual: parseFloat(formData.material_didatico_anual)
      };

      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update(classData)
          .eq('id', editingClass.id);

        if (error) throw error;
        toast.success('Turma atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert(classData);

        if (error) throw error;
        toast.success('Turma criada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchClasses();
    } catch (error) {
      console.error('Erro ao salvar turma:', error);
      toast.error('Erro ao salvar turma');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (classItem: Class) => {
    setEditingClass(classItem);
    const annuity = (classItem as any).annuity?.toString() || '0';
    const parcelas = (classItem as any).parcelas?.toString() || '1';
    
    setFormData({
      name: classItem.name,
      series_id: classItem.series_id,
      unit_id: classItem.unit_id,
      has_exam: classItem.has_exam,
      monthly_fee: '', // Será calculado pelo useEffect
      annuity: annuity,
      parcelas: parcelas,
      material_didatico_anual: (classItem as any).material_didatico_anual?.toString() || '0'
    });
    setDialogOpen(true);
  };

  const handleDelete = async (classItem: Class) => {
    if (!confirm('Tem certeza que deseja excluir esta turma?')) return;

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classItem.id);

      if (error) throw error;
      toast.success('Turma excluída com sucesso!');
      fetchClasses();
    } catch (error) {
      console.error('Erro ao excluir turma:', error);
      toast.error('Erro ao excluir turma');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      series_id: '',
      unit_id: '',
      has_exam: true,
      monthly_fee: '',
      annuity: '',
      parcelas: '',
      material_didatico_anual: ''
    });
    setEditingClass(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestão de Turmas</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Turma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingClass ? 'Editar Turma' : 'Nova Turma'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="series">Série *</Label>
                <Select value={formData.series_id} onValueChange={(value) => setFormData(prev => ({ ...prev, series_id: value }))}>
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
              <div>
                <Label htmlFor="unit">Unidade *</Label>
                <Select value={formData.unit_id} onValueChange={(value) => setFormData(prev => ({ ...prev, unit_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="monthly_fee">Mensalidade (R$) - Calculada automaticamente</Label>
                <Input
                  id="monthly_fee"
                  type="number"
                  step="0.01"
                  value={formData.monthly_fee}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  placeholder="Será calculada automaticamente"
                />
              </div>
              <div>
                <Label htmlFor="annuity">Anuidade (R$) *</Label>
                <Input
                  id="annuity"
                  type="number"
                  step="0.01"
                  value={formData.annuity}
                  onChange={(e) => setFormData(prev => ({ ...prev, annuity: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="parcelas">Número de Parcelas *</Label>
                <Input
                  id="parcelas"
                  type="number"
                  min="1"
                  value={formData.parcelas}
                  onChange={(e) => setFormData(prev => ({ ...prev, parcelas: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="material_didatico_anual">Material Didático Anual (R$) *</Label>
                <Input
                  id="material_didatico_anual"
                  type="number"
                  step="0.01"
                  value={formData.material_didatico_anual}
                  onChange={(e) => setFormData(prev => ({ ...prev, material_didatico_anual: e.target.value }))}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_exam"
                  checked={formData.has_exam}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_exam: !!checked }))}
                />
                <Label htmlFor="has_exam">Possui prova de seleção</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : editingClass ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Turmas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Série</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead>Anuidade</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Material Didático</TableHead>
                <TableHead>Tem Prova</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((classItem) => (
                <TableRow key={classItem.id}>
                  <TableCell>{classItem.name}</TableCell>
                  <TableCell>{classItem.series.name}</TableCell>
                  <TableCell>{classItem.units.name}</TableCell>
                  <TableCell>R$ {classItem.monthly_fee.toFixed(2)}</TableCell>
                  <TableCell>R$ {((classItem as any).annuity || 0).toFixed(2)}</TableCell>
                  <TableCell>{(classItem as any).parcelas || 1}</TableCell>
                  <TableCell>R$ {((classItem as any).material_didatico_anual || 0).toFixed(2)}</TableCell>
                  <TableCell>{classItem.has_exam ? 'Sim' : 'Não'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(classItem)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(classItem)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
