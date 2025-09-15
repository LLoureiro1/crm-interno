import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { sanitizeName, sanitizeEmail } from '@/utils/sanitization';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'> & {
  units?: { name: string };
};
type Unit = Tables<'units'>;

export const UserManagement = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'padrao' as Tables<'profiles'>['profile'],
    unit_id: '',
    temporaryPassword: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchUnits();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        units (name)
      `)
      .order('name');

    if (error) {
      toast.error('Erro ao carregar usuários');
      return;
    }

    setUsers(data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação para criação de usuário
    if (!editingUser && (!formData.temporaryPassword || formData.temporaryPassword.length < 6)) {
      toast.error('A senha temporária deve ter pelo menos 6 caracteres');
      return;
    }
    
    setLoading(true);

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            email: formData.email,
            profile: formData.profile,
            unit_id: formData.unit_id || null
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        toast.success('Usuário atualizado com sucesso!');
      } else {
        // Criar novo usuário com convite por email
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.temporaryPassword,
          email_confirm: true,
          user_metadata: {
            name: formData.name,
            profile: formData.profile,
            unit_id: formData.unit_id || null
          }
        });

        if (authError) throw authError;

        // Criar perfil na tabela profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            name: formData.name,
            email: formData.email,
            profile: formData.profile,
            unit_id: formData.unit_id || null
          });

        if (profileError) throw profileError;

        toast.success('Usuário criado com sucesso! Convite enviado por email.');
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      profile: user.profile,
      unit_id: user.unit_id || '',
      temporaryPassword: '' // Não preencher senha ao editar
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      profile: 'padrao',
      unit_id: '',
      temporaryPassword: ''
    });
    setEditingUser(null);
  };

  const profileLabels = {
    admin: 'Administrador',
    direcao: 'Direção',
    secretaria: 'Secretaria',
    padrao: 'Padrão'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestão de Usuários</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: sanitizeName(e.target.value) }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: sanitizeEmail(e.target.value) }))}
                  required
                />
              </div>
              {!editingUser && (
                <div>
                  <Label htmlFor="temporaryPassword">Senha Temporária *</Label>
                  <Input
                    id="temporaryPassword"
                    type="password"
                    value={formData.temporaryPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                    placeholder="Senha temporária para o usuário"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    O usuário receberá um convite por email e poderá alterar esta senha no primeiro login.
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="profile">Perfil *</Label>
                <Select value={formData.profile} onValueChange={(value: any) => setFormData(prev => ({ ...prev, profile: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="direcao">Direção</SelectItem>
                    <SelectItem value="secretaria">Secretaria</SelectItem>
                    <SelectItem value="padrao">Padrão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="unit">Unidade</Label>
                <Select value={formData.unit_id} onValueChange={(value) => setFormData(prev => ({ ...prev, unit_id: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma unidade</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : editingUser ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{profileLabels[user.profile]}</TableCell>
                  <TableCell>{user.units?.name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(user)}
                      className="mr-2"
                    >
                      <Pencil className="h-4 w-4" />
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
