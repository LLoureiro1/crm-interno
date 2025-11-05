import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Layout } from '@/components/Layout';

type Unit = Tables<'units'>;
type Serie = Tables<'series'>;

type AssignedItem = Tables<'contact_list_items'> & {
  students?: Tables<'students'> & {
    classes?: Tables<'classes'> & { units?: Unit; series?: Serie };
    student_phones?: { phone_number: string }[];
  };
  profiles?: Tables<'profiles'>;
  contact_lists?: { id: string; name: string } | null;
};

const AssignedContacts = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<AssignedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchAssignedItems(profile.id);

    const channel = supabase
      .channel(`contact_list_items_assigned_${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contact_list_items',
        filter: `assigned_user_id=eq.${profile.id}`
      }, () => {
        fetchAssignedItems(profile.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchAssignedItems = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_list_items')
        .select(`
          *,
          students (*, classes(*, units(*), series(*)), student_phones(phone_number)),
          profiles (*),
          contact_lists (id, name)
        `)
        .eq('assigned_user_id', userId)
        .order('entered_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as AssignedItem[]);
    } catch (err) {
      toast.error('Erro ao carregar seus designados');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let res = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(it => {
        const name = it.students?.student_name?.toLowerCase() || '';
        const unit = it.students?.classes?.units?.name?.toLowerCase() || '';
        const series = it.students?.classes?.series?.name?.toLowerCase() || '';
        const clazz = it.students?.classes?.name?.toLowerCase() || '';
        return name.includes(q) || unit.includes(q) || series.includes(q) || clazz.includes(q);
      });
    }
    if (showOnlyActive) {
      res = res.filter(it => !it.left_at);
    }
    return res;
  }, [items, search, showOnlyActive]);

  const grouped = useMemo(() => {
    const map = new Map<string, { listId: string; listName: string; items: AssignedItem[] }>();
    for (const it of filtered) {
      const listId = it.list_id;
      const listName = it.contact_lists?.name || it.list_id;
      const key = listId;
      const prev = map.get(key);
      if (prev) {
        prev.items.push(it);
      } else {
        map.set(key, { listId, listName, items: [it] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.listName.localeCompare(b.listName));
  }, [filtered]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Meus Alunos Designados</h2>
            <p className="text-gray-600">Veja suas listas e alunos atribuídos a você.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Buscar por aluno, unidade, série ou turma..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Mostrar apenas ativos</label>
                <input
                  type="checkbox"
                  checked={showOnlyActive}
                  onChange={(e) => setShowOnlyActive(e.target.checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center text-gray-600">Carregando...</div>
        )}

        {!loading && grouped.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum aluno designado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Você ainda não possui alunos designados.</p>
            </CardContent>
          </Card>
        )}

        {grouped.map(group => {
          const activeCount = group.items.filter(i => !i.left_at).length;
          return (
            <Card key={group.listId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{group.listName}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">Total: {group.items.length}</Badge>
                    <Badge variant="outline">Ativos: {activeCount}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Unidade / Série / Turma</TableHead>
                        <TableHead>Entrou</TableHead>
                        <TableHead>Saiu</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.students?.student_name || item.student_id}</TableCell>
                          <TableCell className="text-sm">{item.students?.classes?.units?.name || '-'} / {item.students?.classes?.series?.name || '-'} / {item.students?.classes?.name || '-'}</TableCell>
                          <TableCell className="text-sm">{new Date(item.entered_at).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-sm">{item.left_at ? new Date(item.left_at).toLocaleString('pt-BR') : '-'}</TableCell>
                          <TableCell className="text-sm">
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/student/${item.student_id}`} className="flex items-center">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Abrir ficha
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
};

export default AssignedContacts;