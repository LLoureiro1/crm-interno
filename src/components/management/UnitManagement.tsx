
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
import type { Tables } from '@/integrations/supabase/types';

type Unit = Tables<'units'> & {
  cities?: { name: string } | null;
};
type City = Tables<'cities'>;

export const UnitManagement = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    city_id: '',
    city_name: ''
  });

  useEffect(() => {
    fetchUnits();
    fetchCities();
  }, []);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select(`
        *,
        cities (name)
      `)
      .order('name');

    if (error) {
      toast.error('Erro ao carregar unidades');
      return;
    }

    setUnits(data || []);
  };

  const fetchCities = async () => {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar cidades');
      return;
    }

    setCities(data || []);
  };

  const handleCitySearch = (value: string) => {
    setFormData(prev => ({ ...prev, city_name: value, city_id: '' }));
    
    if (value.length >= 2) {
      const searchTerm = value.toLowerCase().trim();
      const filtered = cities.filter(city => {
        const cityName = city.name.toLowerCase();
        return cityName.startsWith(searchTerm) || cityName.includes(searchTerm);
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        const aStarts = aName.startsWith(searchLower);
        const bStarts = bName.startsWith(searchLower);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
      
      setFilteredCities(filtered);
      setShowCityDropdown(true);
    } else {
      setShowCityDropdown(false);
      setFilteredCities([]);
    }
  };

  const selectCity = (city: City) => {
    setFormData(prev => ({ ...prev, city_id: city.id, city_name: city.name }));
    setShowCityDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Criar ou obter cidade se não existir
      let cityId = formData.city_id;
      if (formData.city_name && !formData.city_id) {
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .insert({ name: formData.city_name })
          .select()
          .single();
        
        if (cityError) {
          console.error('Erro ao criar cidade:', cityError);
          cityId = '';
        } else {
          cityId = cityData.id;
        }
      }

      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update({
            name: formData.name,
            address: formData.address,
            phone: formData.phone,
            city_id: cityId || null
          })
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
            city_id: cityId || null
          });

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
      city_id: unit.city_id || '',
      city_name: unit.cities?.name || ''
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
      city_id: '',
      city_name: ''
    });
    setEditingUnit(null);
    setShowCityDropdown(false);
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
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="address">Endereço *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
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
                {showCityDropdown && filteredCities.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-auto">
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
                {showCityDropdown && filteredCities.length === 0 && formData.city_name.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="px-4 py-2 text-gray-500">
                      Nenhuma cidade encontrada
                    </div>
                  </div>
                )}
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
                  <TableCell>{unit.cities?.name || 'Não informado'}</TableCell>
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
