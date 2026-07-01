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
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Pencil, AlertCircle, UserCheck, UserX } from 'lucide-react';
import { sanitizeName, sanitizeEmail } from '@/utils/sanitization';
import { getUserInviteErrorMessage } from '@/utils/authErrorMessages';
import type { Tables } from '@/integrations/supabase/types';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  unit_id: string | null;
  profile: Tables<'profiles'>['profile'];
  ativo: boolean;
  created_at: string;
  unit_ids: string[] | null;
};

type Unit = Tables<'units'>;
type UserWithNames = AdminUser & { unitNames: string[] };

const mapUsers = (rawUsers: AdminUser[], unitList: Unit[]): UserWithNames[] => {
  const unitMap = new Map(unitList.map((u) => [u.id, u.name]));
  return rawUsers.map((user) => {
    const ids = user.unit_ids ?? (user.unit_id ? [user.unit_id] : []);
    return {
      ...user,
      unit_ids: ids,
      unitNames: ids.map((id) => unitMap.get(id)).filter(Boolean) as string[],
    };
  });
};

export const UserManagement = () => {
  const { profile } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithNames | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'padrao' as Tables<'profiles'>['profile'],
    unit_ids: [] as string[],
  });
  const [usersWithNames, setUsersWithNames] = useState<UserWithNames[]>([]);

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

      const unitList = unitsResult.data || [];
      const mapped = mapUsers((usersResult.data || []) as AdminUser[], unitList);
      setUsersWithNames(mapped);
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

    const mapped = mapUsers((data || []) as AdminUser[], units);
    setUsersWithNames(mapped);
  };

  const toggleUnit = (unitId: string) => {
    setFormData((prev) => {
      const has = prev.unit_ids.includes(unitId);
      return {
        ...prev,
        unit_ids: has
          ? prev.unit_ids.filter((id) => id !== unitId)
          : [...prev.unit_ids, unitId],
      };
    });
  };

  const saveProfileUnits = async (profileId: string, unitIds: string[]) => {
    const { error } = await supabase.rpc('admin_set_profile_units', {
      p_profile_id: profileId,
      p_unit_ids: unitIds,
    });
    if (error) throw error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedEmail = sanitizeEmail(formData.email);
    if (!sanitizedEmail) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    setLoading(true);

    try {
      const primaryUnitId = formData.unit_ids[0] || null;

      if (editingUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            email: sanitizedEmail,
            profile: formData.profile,
            unit_id: primaryUnitId,
          })
          .eq('id', editingUser.id);

        if (error) throw error;

        await saveProfileUnits(editingUser.id, formData.unit_ids);
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

        const { data, error } = await supabase.functions.invoke('create-user-invite', {
          body: {
            name: formData.name,
            email: sanitizedEmail,
            profile: formData.profile,
            unit_id: primaryUnitId,
            unit_ids: formData.unit_ids,
          },
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
      const message = error instanceof Error ? error.message : 'Erro ao salvar usuário';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserWithNames) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      profile: user.profile,
      unit_ids: user.unit_ids ?? (user.unit_id ? [user.unit_id] : []),
    });
    setDialogOpen(true);
  };

  const handleDeactivate = async (user: AdminUser) => {
    if (!confirm(`Tem certeza que deseja desativar o usuário "${user.name}"?\n\nO usuário será desconectado imediatamente e não poderá mais acessar o sistema.`)) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ativo: false })
        .eq('id', user.id)
        .select();

      if (error) throw error;

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

  const handleActivate = async (user: AdminUser) => {
    if (!confirm(`Tem certeza que deseja reativar o usuário "${user.name}"?`)) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ativo: true })
        .eq('id', user.id)
        .select();

      if (error) throw error;

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
      unit_ids: [],
    });
    setEditingUser(null);
  };

  const profileLabels = {
    admin: 'Administrador',
    direcao: 'Direção',
    entrevistador: 'Entrevistador',
    padrao: 'Padrão',
  };

  const isAdmin = profile?.profile === 'admin';

  return (
    <div className="min-w-0 space-y-6">
      {!isAdmin && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Apenas usuários com perfil de administrador podem gerenciar usuários.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">Gestão de Usuários</h3>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                      const sanitizedValue = sanitizeName(e.target.value);
                      setFormData((prev) => ({ ...prev, name: sanitizedValue }));
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
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
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
                  <Select
                    value={formData.profile}
                    onValueChange={(value: Tables<'profiles'>['profile']) =>
                      setFormData((prev) => ({ ...prev, profile: value }))
                    }
                  >
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
                  <Label>Unidades de acesso</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Selecione uma ou mais unidades. Administradores e usuários da Central têm acesso a todas automaticamente.
                  </p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                    {units.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
                    ) : (
                      units.map((unit) => (
                        <label
                          key={unit.id}
                          htmlFor={`unit-${unit.id}`}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            id={`unit-${unit.id}`}
                            checked={formData.unit_ids.includes(unit.id)}
                            onCheckedChange={() => toggleUnit(unit.id)}
                          />
                          <span>{unit.name}</span>
                        </label>
                      ))
                    )}
                  </div>
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
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithNames.map((user) => (
                    <TableRow key={user.id} className={user.ativo === false ? 'opacity-60' : ''}>
                      <TableCell className="min-w-[120px]">{user.name}</TableCell>
                      <TableCell className="max-w-[180px] truncate sm:max-w-none sm:whitespace-normal">
                        {user.email}
                      </TableCell>
                      <TableCell>{profileLabels[user.profile]}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {user.profile === 'admin' ? (
                          <span className="text-muted-foreground text-sm">Todas</span>
                        ) : user.unitNames.length > 0 ? (
                          user.unitNames.join(', ')
                        ) : (
                          '-'
                        )}
                      </TableCell>
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
