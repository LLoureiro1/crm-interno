import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Save, Users } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  ativo: boolean;
  profile: Tables<'profiles'>['profile'];
};

type WhatsappViewerAccessManagementProps = {
  instanceName: string;
};

export function WhatsappViewerAccessManagement({ instanceName }: WhatsappViewerAccessManagementProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.from('whatsapp_integrations').upsert(
        { instance_name: instanceName, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'instance_name' },
      );

      const [usersResult, accessResult] = await Promise.all([
        supabase.rpc('list_users_for_admin'),
        supabase.from('whatsapp_viewer_access').select('user_id').eq('instance_name', instanceName),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (accessResult.error) throw accessResult.error;

      const activeUsers = (usersResult.data ?? []).filter((u) => u.ativo);
      setUsers(activeUsers);
      setSelectedIds(new Set((accessResult.data ?? []).map((row) => row.user_id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [instanceName]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleUser = (userId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('whatsapp_viewer_access')
        .delete()
        .eq('instance_name', instanceName);
      if (deleteError) throw deleteError;

      if (selectedIds.size > 0) {
        const rows = [...selectedIds].map((user_id) => ({ instance_name: instanceName, user_id }));
        const { error: insertError } = await supabase.from('whatsapp_viewer_access').insert(rows);
        if (insertError) throw insertError;
      }

      toast.success('Permissões de visualização salvas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando usuários...
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Quem pode ver as conversas na Qualificação</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Administradores sempre têm acesso. Selecione os usuários ativos que podem visualizar as conversas
        do número conectado (<code className="text-xs">{instanceName}</code>).
      </p>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-gray-200 bg-white p-3">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário ativo encontrado.</p>
        ) : (
          users.map((user) => (
            <label key={user.id} className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={selectedIds.has(user.id)}
                onCheckedChange={(checked) => toggleUser(user.id, checked === true)}
              />
              <span>
                {user.name}{' '}
                <span className="text-muted-foreground">({user.email})</span>
              </span>
            </label>
          ))
        )}
      </div>
      <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar permissões
      </Button>
    </div>
  );
}
