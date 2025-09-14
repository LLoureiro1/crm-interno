
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { sanitizePlainText, sanitizePhone } from '@/utils/sanitization';
import type { Tables } from '@/integrations/supabase/types';

type Unit = Tables<'units'> & {
  city?: string | null;
};

export const UnitManagement = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    city_name: ''
  });

  useEffect(() => {
    fetchUnits();
  }, []);

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

  const handleCitySearch = (value: string) => {
    setFormData(prev => ({ ...prev, city_name: value }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update({
            name: formData.name,
            address: formData.address,
            phone: formData.phone,
            city: formData.city_name || null
          } as any)
          .eq('id', editingUnit.id);

        if (error) throw error;
        toast.success('Unidade atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('units')
          .insert({
            name: formData.name,
            address: formData.address,
            phone: formData.phone,
            city: formData.city_name || null
          } as any);

        if (error) throw error;
        toast.success('Unidade criada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchUnits();
    } catch (error) {
      console.error('Erro ao salvar unidade:', error);
      toast.error('Erro ao salvar unidade');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      address: unit.address,
      phone: unit.phone,
      city_name: unit.city || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (unit: Unit) => {
    if (!confirm('Tem certeza que deseja excluir esta unidade?')) return;

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unit.id);

      if (error) throw error;
      toast.success('Unidade excluída com sucesso!');
      fetchUnits();
    } catch (error) {
      console.error('Erro ao excluir unidade:', error);
      toast.error('Erro ao excluir unidade');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      city_name: ''
    });
    setEditingUnit(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestão de Unidades</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Unidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUnit ? 'Editar Unidade' : 'Nova Unidade'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: sanitizePlainText(e.target.value) }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="address">Endereço *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: sanitizePlainText(e.target.value) }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: sanitizePhone(e.target.value) }))}
                  required
                />
              </div>
              <div className="relative">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city_name}
                  onChange={(e) => handleCitySearch(e.target.value)}
                  placeholder="Digite o nome da cidade (opcional)"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : editingUnit ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Unidades</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>{unit.name}</TableCell>
                  <TableCell>{unit.address}</TableCell>
                  <TableCell>{unit.phone}</TableCell>
                  <TableCell>{unit.city || 'Não informado'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(unit)}
                      className="mr-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(unit)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
