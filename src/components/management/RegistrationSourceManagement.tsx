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

type Unit = Tables<'units'>;
type RegistrationSource = Tables<'unit_registration_sources'>;

export const RegistrationSourceManagement = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [sources, setSources] = useState<RegistrationSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<RegistrationSource | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [formData, setFormData] = useState({
    source_key: '',
    source_label: '',
    is_active: true,
    sort_order: 0
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    if (selectedUnit) {
      fetchSources(selectedUnit);
    } else {
      setSources([]);
    }
  }, [selectedUnit]);

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

  const fetchSources = async (unitId: string) => {
    const { data, error } = await supabase
      .from('unit_registration_sources')
      .select('*')
      .eq('unit_id', unitId)
      .order('sort_order', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar origens');
      return;
    }

    setSources(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUnit) {
      toast.error('Selecione uma unidade');
      return;
    }

    if (!formData.source_key.trim() || !formData.source_label.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      const sanitizedData = {
        unit_id: selectedUnit,
        source_key: sanitizePlainText(formData.source_key),
        source_label: sanitizePlainText(formData.source_label),
        is_active: formData.is_active,
        sort_order: formData.sort_order
      };

      if (editingSource) {
        const { error } = await supabase
          .from('unit_registration_sources')
          .update(sanitizedData)
          .eq('id', editingSource.id);

        if (error) throw error;
        toast.success('Origem atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('unit_registration_sources')
          .insert(sanitizedData);

        if (error) throw error;
        toast.success('Origem criada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchSources(selectedUnit);
    } catch (error) {
      console.error('Erro ao salvar origem:', error);
      toast.error('Erro ao salvar origem');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (source: RegistrationSource) => {
    setEditingSource(source);
    setFormData({
      source_key: source.source_key,
      source_label: source.source_label,
      is_active: source.is_active,
      sort_order: source.sort_order
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta origem?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('unit_registration_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Origem excluída com sucesso!');
      fetchSources(selectedUnit);
    } catch (error) {
      console.error('Erro ao excluir origem:', error);
      toast.error('Erro ao excluir origem');
    }
  };

  const handleToggleActive = async (source: RegistrationSource) => {
    try {
      const { error } = await supabase
        .from('unit_registration_sources')
        .update({ is_active: !source.is_active })
        .eq('id', source.id);

      if (error) throw error;
      toast.success('Status atualizado com sucesso!');
      fetchSources(selectedUnit);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleMoveUp = async (source: RegistrationSource) => {
    const currentIndex = sources.findIndex(s => s.id === source.id);
    if (currentIndex <= 0) return;

    const previousSource = sources[currentIndex - 1];
    
    try {
      // Trocar as posições
      await supabase
        .from('unit_registration_sources')
        .update({ sort_order: previousSource.sort_order })
        .eq('id', source.id);

      await supabase
        .from('unit_registration_sources')
        .update({ sort_order: source.sort_order })
        .eq('id', previousSource.id);

      toast.success('Ordem atualizada!');
      fetchSources(selectedUnit);
    } catch (error) {
      console.error('Erro ao reordenar:', error);
      toast.error('Erro ao reordenar');
    }
  };

  const handleMoveDown = async (source: RegistrationSource) => {
    const currentIndex = sources.findIndex(s => s.id === source.id);
    if (currentIndex >= sources.length - 1) return;

    const nextSource = sources[currentIndex + 1];
    
    try {
      // Trocar as posições
      await supabase
        .from('unit_registration_sources')
        .update({ sort_order: nextSource.sort_order })
        .eq('id', source.id);

      await supabase
        .from('unit_registration_sources')
        .update({ sort_order: source.sort_order })
        .eq('id', nextSource.id);

      toast.success('Ordem atualizada!');
      fetchSources(selectedUnit);
    } catch (error) {
      console.error('Erro ao reordenar:', error);
      toast.error('Erro ao reordenar');
    }
  };

  const resetForm = () => {
    setEditingSource(null);
    setFormData({
      source_key: '',
      source_label: '',
      is_active: true,
      sort_order: sources.length + 1
    });
  };

  const selectedUnitName = units.find(u => u.id === selectedUnit)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Origens de Inscrição</h3>
          <p className="text-sm text-gray-600">
            Configure as opções de origem das inscrições por unidade
          </p>
        </div>
        
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
                {editingSource ? 'Editar Origem' : 'Nova Origem'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="unit">Unidade *</Label>
                <Select
                  value={selectedUnit}
                  onValueChange={setSelectedUnit}
                  disabled={!!editingSource}
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
                <Label htmlFor="source_key">Chave da Origem *</Label>
                <Input
                  id="source_key"
                  value={formData.source_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, source_key: e.target.value }))}
                  placeholder="Ex: instagram, google_search"
                  disabled={!!editingSource}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Identificador único (não pode ser alterado após criação)
                </p>
              </div>

              <div>
                <Label htmlFor="source_label">Label da Origem *</Label>
                <Input
                  id="source_label"
                  value={formData.source_label}
                  onChange={(e) => setFormData(prev => ({ ...prev, source_label: e.target.value }))}
                  placeholder="Ex: Instagram, Pesquisa no Google"
                />
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
                  {loading ? 'Salvando...' : editingSource ? 'Atualizar' : 'Criar'}
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
              {sources.length} origem(ões) configurada(s)
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
                    <TableHead>Chave</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source, index) => (
                    <TableRow key={source.id}>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveUp(source)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{source.sort_order}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveDown(source)}
                            disabled={index === sources.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {source.source_key}
                      </TableCell>
                      <TableCell>{source.source_label}</TableCell>
                      <TableCell>
                        <Switch
                          checked={source.is_active}
                          onCheckedChange={() => handleToggleActive(source)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(source)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(source.id)}
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
