
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { ClassUpload } from './ClassUpload';

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
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const computeMonthlyFee = (annuityStr: string, parcelasStr: string) => {
    const annuity = parseFloat(annuityStr);
    const parcelas = parseInt(parcelasStr);
    if (isNaN(annuity) || isNaN(parcelas) || parcelas <= 0) return null;
    return parseFloat((annuity / parcelas).toFixed(2));
  };

  const computeMaterialMensal = (anualStr: string, parcelasStr: string) => {
    const anual = parseFloat(anualStr);
    const parcelas = parseInt(parcelasStr);
    if (isNaN(anual) || isNaN(parcelas) || parcelas <= 0) return null;
    return parseFloat((anual / parcelas).toFixed(2));
  };

  // Normaliza entrada decimal permitindo vírgula ou ponto como separador
  const normalizeDecimalInput = (value: string): string => {
    if (!value) return '';
    const sanitized = value.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
    const lastDotIndex = sanitized.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const before = sanitized.slice(0, lastDotIndex).replace(/\./g, '');
      const after = sanitized.slice(lastDotIndex + 1).replace(/\./g, '');
      return `${before}.${after}`;
    }
    return sanitized.replace(/\./g, '');
  };

  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    series_id: '',
    unit_id: '',
    has_exam: true,
    monthly_fee: '',
    annuity: '',
    parcelas: '12',
    material_didatico_anual: '',
    material_didatico_mes: ''
  });

  useEffect(() => {
    fetchClasses();
    fetchUnits();
    fetchSeries();
  }, []);

  // Calcular mensalidade automaticamente baseado na anuidade e parcelas
  useEffect(() => {
    const fee = computeMonthlyFee(formData.annuity, formData.parcelas);
    setFormData(prev => ({ ...prev, monthly_fee: fee !== null ? fee.toFixed(2) : '' }));
  }, [formData.annuity, formData.parcelas]);

  // Calcular recursos didáticos mensal automaticamente baseado no material anual e parcelas
  useEffect(() => {
    const materialMensal = computeMaterialMensal(formData.material_didatico_anual, formData.parcelas);
    setFormData(prev => ({ ...prev, material_didatico_mes: materialMensal !== null ? materialMensal.toFixed(2) : '' }));
  }, [formData.material_didatico_anual, formData.parcelas]);

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
      const feeNum = computeMonthlyFee(formData.annuity, formData.parcelas);
      const materialMensalNum = computeMaterialMensal(formData.material_didatico_anual, formData.parcelas);

      if (feeNum === null) {
        toast.error('Informe anuidade e número de parcelas maiores que 0 para calcular a mensalidade.');
        setLoading(false);
        return;
      }

      const classData = {
        name: formData.name,
        series_id: formData.series_id,
        unit_id: formData.unit_id,
        has_exam: formData.has_exam,
        monthly_fee: feeNum,
        annuity: parseFloat(formData.annuity),
        parcelas: parseInt(formData.parcelas),
        material_didatico_anual: parseFloat(formData.material_didatico_anual),
        material_didatico_mes: materialMensalNum ?? 0
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
    const parcelas = (classItem as any).parcelas?.toString() || '12';
    const materialAnual = (classItem as any).material_didatico_anual?.toString() || '0';

    const feeNum = computeMonthlyFee(annuity, parcelas);
    const materialMensalNum = computeMaterialMensal(materialAnual, parcelas);
    
    setFormData({
      name: classItem.name,
      series_id: classItem.series_id,
      unit_id: classItem.unit_id,
      has_exam: classItem.has_exam,
      monthly_fee: feeNum !== null ? feeNum.toFixed(2) : '',
      annuity: annuity,
      parcelas: parcelas,
      material_didatico_anual: materialAnual,
      material_didatico_mes: materialMensalNum !== null ? materialMensalNum.toFixed(2) : ''
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
      parcelas: '12',
      material_didatico_anual: '',
      material_didatico_mes: ''
    });
    setEditingClass(null);
  };

  const visibleClasses = unitFilter === 'all' ? classes : classes.filter(c => c.unit_id === unitFilter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestão de Turmas</h3>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Lista de Turmas</TabsTrigger>
          <TabsTrigger value="upload">Upload em Massa</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Turma
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-[920px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingClass ? 'Editar Turma' : 'Nova Turma'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col space-y-3 md:grid md:grid-cols-2 md:gap-4">
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
                      type="text"
                      inputMode="decimal"
                      value={formData.annuity}
                      onChange={(e) => setFormData(prev => ({ ...prev, annuity: normalizeDecimalInput(e.target.value) }))}
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
                    <Label htmlFor="material_didatico_anual">Recursos Didáticos Anual (R$) *</Label>
                    <Input
                      id="material_didatico_anual"
                      type="text"
                      inputMode="decimal"
                      value={formData.material_didatico_anual}
                      onChange={(e) => setFormData(prev => ({ ...prev, material_didatico_anual: normalizeDecimalInput(e.target.value) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="material_didatico_mes">Recursos Didáticos Mensal (R$) - Calculado automaticamente</Label>
                    <Input
                      id="material_didatico_mes"
                      type="number"
                      step="0.01"
                      value={formData.material_didatico_mes}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                      placeholder="Será calculado automaticamente"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center space-x-2">
                    <Checkbox
                      id="has_exam"
                      checked={formData.has_exam}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_exam: !!checked }))}
                    />
                    <Label htmlFor="has_exam">Possui prova de seleção</Label>
                  </div>
                  <div className="md:col-span-2 flex justify-end space-x-2">
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
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Lista de Turmas</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Unidade</Label>
                <Select value={unitFilter} onValueChange={setUnitFilter}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Todas as unidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <TableHead>Recuros Didáticos Anual</TableHead>
                    <TableHead>Recursos Didáticos Mensal</TableHead>
                    <TableHead>Tem Prova</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleClasses.map((classItem) => (
                    <TableRow key={classItem.id}>
                      <TableCell>{classItem.name}</TableCell>
                      <TableCell>{classItem.series.name}</TableCell>
                      <TableCell>{classItem.units.name}</TableCell>
                      <TableCell>R$ {classItem.monthly_fee.toFixed(2)}</TableCell>
                      <TableCell>R$ {((classItem as any).annuity || 0).toFixed(2)}</TableCell>
                      <TableCell>{(classItem as any).parcelas || 1}</TableCell>
                      <TableCell>R$ {((classItem as any).material_didatico_anual || 0).toFixed(2)}</TableCell>
                      <TableCell>R$ {((classItem as any).material_didatico_mes || 0).toFixed(2)}</TableCell>
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
            </TabsContent>
            
            <TabsContent value="upload">
              <ClassUpload onUploadSuccess={fetchClasses} />
            </TabsContent>
          </Tabs>
        </div>
      );
};
