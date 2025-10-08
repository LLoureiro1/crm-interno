import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { sanitizePlainText } from '@/utils/sanitization';
import type { Tables } from '@/integrations/supabase/types';
import { useRegistrationSourceManagement } from '@/hooks/useRegistrationSourceManagement';

type Unit = Tables<'units'>;

// Interfaces para a nova estrutura
interface GlobalRegistrationSource {
  id: string;
  source_key: string;
  source_label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UnitRegistrationSourceAssociation {
  id: string;
  unit_id: string;
  global_source_id: string;
  is_active: boolean;
  sort_order: number;
  custom_label?: string;
  created_at: string;
  updated_at: string;
  global_registration_sources?: GlobalRegistrationSource;
}

export const RegistrationSourceManagement = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState<UnitRegistrationSourceAssociation | null>(null);
  const [formData, setFormData] = useState({
    global_source_id: '',
    custom_label: '',
    is_active: true,
    sort_order: 0
  });

  // Usar o hook personalizado
  const {
    sources,
    globalSources,
    loading,
    error,
    fetchSources,
    fetchGlobalSources,
    createAssociation,
    updateAssociation,
    deleteAssociation,
    toggleActive,
    swapOrder
  } = useRegistrationSourceManagement({ unitId: selectedUnit });

  useEffect(() => {
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

    fetchUnits();
    fetchGlobalSources();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUnit) {
      toast.error('Selecione uma unidade');
      return;
    }

    if (!formData.global_source_id) {
      toast.error('Selecione uma origem global');
      return;
    }

    try {
      if (editingAssociation) {
        // Atualizar associação existente
        await updateAssociation(editingAssociation.id, {
          custom_label: formData.custom_label ? sanitizePlainText(formData.custom_label) : null,
          is_active: formData.is_active,
          sort_order: formData.sort_order
        });
      } else {
        // Criar nova associação
        await createAssociation(
          formData.global_source_id,
          formData.custom_label ? sanitizePlainText(formData.custom_label) : undefined
        );
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar associação:', error);
      toast.error('Erro ao salvar associação');
    }
  };

  const handleEdit = (association: UnitRegistrationSourceAssociation) => {
    setEditingAssociation(association);
    setFormData({
      global_source_id: association.global_source_id,
      custom_label: association.custom_label || '',
      is_active: association.is_active,
      sort_order: association.sort_order
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta associação?')) {
      return;
    }

    try {
      await deleteAssociation(id);
    } catch (error) {
      console.error('Erro ao remover associação:', error);
      toast.error('Erro ao remover associação');
    }
  };

  const handleToggleActive = async (association: UnitRegistrationSourceAssociation) => {
    try {
      await toggleActive(association.id, !association.is_active);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleMoveUp = async (association: UnitRegistrationSourceAssociation) => {
    const currentIndex = sources.findIndex(s => s.id === association.id);
    if (currentIndex <= 0) return;

    const previousAssociation = sources[currentIndex - 1];
    
    try {
      await swapOrder(association.id, previousAssociation.id);
    } catch (error) {
      console.error('Erro ao reordenar:', error);
      toast.error('Erro ao reordenar');
    }
  };

  const handleMoveDown = async (association: UnitRegistrationSourceAssociation) => {
    const currentIndex = sources.findIndex(s => s.id === association.id);
    if (currentIndex >= sources.length - 1) return;

    const nextAssociation = sources[currentIndex + 1];
    
    try {
      await swapOrder(association.id, nextAssociation.id);
    } catch (error) {
      console.error('Erro ao reordenar:', error);
      toast.error('Erro ao reordenar');
    }
  };

  const resetForm = () => {
    setEditingAssociation(null);
    setFormData({
      global_source_id: '',
      custom_label: '',
      is_active: true,
      sort_order: sources.length + 1
    });
  };

  const selectedUnitName = units.find(u => u.id === selectedUnit)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
               
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Origem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAssociation ? 'Editar Associação' : 'Nova Associação'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="unit">Unidade *</Label>
                <Select
                  value={selectedUnit}
                  onValueChange={setSelectedUnit}
                  disabled={!!editingAssociation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma unidade" />
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
                <Label htmlFor="global_source_id">Origem Global *</Label>
                <Select
                  value={formData.global_source_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, global_source_id: value }))}
                  disabled={!!editingAssociation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma origem global" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.source_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione uma origem global para associar à unidade
                </p>
              </div>

              <div>
                <Label htmlFor="custom_label">Label Personalizado (Opcional)</Label>
                <Input
                  id="custom_label"
                  value={formData.custom_label}
                  onChange={(e) => setFormData(prev => ({ ...prev, custom_label: e.target.value }))}
                  placeholder="Ex: Instagram Centro, Google Shopping"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe vazio para usar o label padrão da origem global
                </p>
              </div>

              <div>
                <Label htmlFor="sort_order">Ordem de Exibição</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  min="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Ativo</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : editingAssociation ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma unidade para gerenciar suas origens" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedUnit && (
        <Card>
          <CardHeader>
            <CardTitle>Origens - {selectedUnitName}</CardTitle>
            <p className="text-sm text-gray-600">
              {sources.length} origens configuradas
            </p>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma origem configurada para esta unidade.
                <br />
                Clique em "Nova Origem" para adicionar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Origem Global</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((association, index) => (
                    <TableRow key={association.id}>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveUp(association)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{association.sort_order}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveDown(association)}
                            disabled={index === sources.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {association.global_registration_sources?.source_key || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {association.custom_label || association.global_registration_sources?.source_label || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={association.is_active}
                          onCheckedChange={() => handleToggleActive(association)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(association)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(association.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
