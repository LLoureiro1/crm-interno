import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AlertCircle, UserCheck, UserX } from 'lucide-react';
import { sanitizeName, sanitizeEmail } from '@/utils/sanitization';
import { getUserInviteErrorMessage } from '@/utils/authErrorMessages';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'> & {
  units?: { name: string };
};
type Unit = Tables<'units'>;

export const UserManagement = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'padrao' as Tables<'profiles'>['profile'],
    unit_id: ''
  });

  useEffect(() => {
    if (profile?.profile !== 'admin') return;

    const load = async () => {
      const [unitsResult, usersResult] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        supabase.rpc('list_users_for_admin'),
      ]);

      if (unitsResult.error) {
        toast.error('Erro ao carregar unidades');
      } else {
        setUnits(unitsResult.data || []);
      }

      if (usersResult.error) {
        console.error('Erro ao carregar usuários:', usersResult.error);
        toast.error('Erro ao carregar usuários');
        return;
      }

      const unitMap = new Map((unitsResult.data || []).map((u) => [u.id, u.name]));
      setUsers(
        (usersResult.data || []).map((user) => ({
          ...user,
          units: user.unit_id
            ? { name: unitMap.get(user.unit_id) || '' }
            : undefined,
        }))
      );
    };

    load();
  }, [profile?.profile]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc('list_users_for_admin');

    if (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
      return;
    }

    const unitMap = new Map(units.map((u) => [u.id, u.name]));

    setUsers(
      (data || []).map((user) => ({
        ...user,
        units: user.unit_id
          ? { name: unitMap.get(user.unit_id) || '' }
          : undefined,
      }))
    );
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
    
    // Sanitizar e validar email antes do envio
    const sanitizedEmail = sanitizeEmail(formData.email);
    if (!sanitizedEmail) {
      toast.error('Por favor, insira um email válido');
      return;
    }
    
    setLoading(true);

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            email: sanitizedEmail,
            profile: formData.profile,
            unit_id: formData.unit_id || null
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        toast.success('Usuário atualizado com sucesso!');
      } else {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, name, email, ativo')
          .eq('email', sanitizedEmail)
          .maybeSingle();

        if (existingProfile) {
          if (existingProfile.ativo === false) {
            toast.error(
              `Este e-mail já pertence ao usuário "${existingProfile.name}", que está inativo. Reative-o na lista de usuários em vez de criar um novo cadastro.`,
            );
          } else {
            toast.error('Este e-mail já está cadastrado na base de usuários.');
          }
          return;
        }

        // Criar novo usuário usando Edge Function
        const { data, error } = await supabase.functions.invoke('create-user-invite', {
          body: {
            name: formData.name,
            email: sanitizedEmail,
            profile: formData.profile,
            unit_id: formData.unit_id || null
          }
        });

        if (error || data?.error) {
          throw new Error(getUserInviteErrorMessage(error, data));
        }

        if (data?.invite_error) {
          toast.success('Usuário criado com sucesso, mas houve problema ao enviar o convite por email. O usuário pode solicitar um novo convite.');
        } else {
          toast.success('Usuário criado com sucesso! Convite enviado por email.');
        }
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      const message = error instanceof Error
        ? error.message
        : 'Erro ao salvar usuário';
      toast.error(message);
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
      unit_id: user.unit_id || ''
    });
    setDialogOpen(true);
  };

  const handleDeactivate = async (user: Profile) => {
    if (!confirm(`Tem certeza que deseja desativar o usuário "${user.name}"?\n\nO usuário será desconectado imediatamente e não poderá mais acessar o sistema.`)) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ativo: false })
        .eq('id', user.id)
        .select();

      if (error) {
        console.error('Erro do Supabase:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        toast.warning('Nenhum registro foi alterado. Verifique as permissões.');
        return;
      }

      toast.success('Usuário desativado com sucesso! Ele será desconectado automaticamente.');
      await fetchUsers();
    } catch (error) {
      console.error('Erro ao desativar usuário:', error);
      toast.error('Erro ao desativar usuário: ' + (error as Error).message);
    }
  };

  const handleActivate = async (user: Profile) => {
    if (!confirm(`Tem certeza que deseja reativar o usuário "${user.name}"?`)) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ativo: true })
        .eq('id', user.id)
        .select();

      if (error) {
        console.error('Erro do Supabase:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        toast.warning('Nenhum registro foi alterado. Verifique as permissões.');
        return;
      }

      toast.success('Usuário reativado com sucesso!');
      await fetchUsers();
    } catch (error) {
      console.error('Erro ao reativar usuário:', error);
      toast.error('Erro ao reativar usuário: ' + (error as Error).message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      profile: 'padrao',
      unit_id: ''
    });
    setEditingUser(null);
  };

  const profileLabels = {
    admin: 'Administrador',
    direcao: 'Direção',
    entrevistador: 'Entrevistador',
    padrao: 'Padrão'
  };

  // Verificar se o usuário tem permissões de admin
  const isAdmin = profile?.profile === 'admin';

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Apenas usuários com perfil de administrador podem gerenciar usuários.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestão de Usuários</h3>
        {isAdmin && (
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
                  onChange={(e) => {
                    const value = e.target.value;
                    const sanitizedValue = sanitizeName(value);
                    setFormData(prev => ({ ...prev, name: sanitizedValue }));
                  }}
                  placeholder="Digite o nome completo"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@exemplo.com"
                  required
                />
              </div>
              {!editingUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Sistema de Convites:</strong> O usuário receberá um email com link para definir sua própria senha de forma segura.
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="profile">Perfil *</Label>
                <Select value={formData.profile} onValueChange={(value: any) => setFormData(prev => ({ ...prev, profile: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent side="bottom">
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="direcao">Direção</SelectItem>
                    <SelectItem value="entrevistador">Entrevistador</SelectItem>
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
                  <SelectContent side="bottom">
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
        )}
      </div>

      {isAdmin && (
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={user.ativo === false ? 'opacity-60' : ''}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{profileLabels[user.profile]}</TableCell>
                  <TableCell>{user.units?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.ativo === false ? 'destructive' : 'success'}>
                      {user.ativo === false ? 'Inativo' : 'Ativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(user)}
                        title="Editar usuário"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.ativo ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivate(user)}
                          className="text-red-600 hover:text-red-700"
                          title="Desativar usuário"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(user)}
                          className="text-green-600 hover:text-green-700"
                          title="Reativar usuário"
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        </Card>
      )}
    </div>
  );
};
