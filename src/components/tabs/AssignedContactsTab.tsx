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
import { ExternalLink, ChevronDown, ChevronRight, Search } from 'lucide-react';

type Unit = Tables<'units'>;
type Serie = Tables<'series'>;

type ContactListFilters = {
  id: string;
  name: string;
  is_active?: boolean | null;
  status_in?: string[] | null;
  unit_ids?: string[] | null;
  series_ids?: string[] | null;
  class_ids?: string[] | null;
  academic_years?: string[] | null;
  exam_date_filters?: string[] | null;
} | null;

type AssignedItem = Tables<'contact_list_items'> & {
  students?: Tables<'students'> & {
    classes?: Tables<'classes'> & { units?: Unit; series?: Serie };
    student_phones?: { phone_number: string }[];
  };
  profiles?: Tables<'profiles'>;
  contact_lists?: ContactListFilters;
};

const formatExamFilter = (val: string) => {
  if (val === 'sem_data') return 'Sem data de prova';
  if (val === 'hoje') return 'Prova hoje';
  if (val === 'futuras') return 'Provas futuras';
  if (val === 'passadas') return 'Provas passadas';
  if (val.startsWith('date_')) {
    const d = val.slice(5);
    try {
      const dt = new Date(d);
      return `Data: ${dt.toLocaleDateString('pt-BR')}`;
    } catch {
      return val;
    }
  }
  return val;
};

export const AssignedContactsTab = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<AssignedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  const [seriesMap, setSeriesMap] = useState<Record<string, string>>({});
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>({});

  const toggleCollapse = (listId: string) => {
    setCollapsedLists(prev => ({ ...prev, [listId]: !prev[listId] }));
  };

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

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [unitsRes, seriesRes, classesRes] = await Promise.all([
          supabase.from('units').select('id, name'),
          supabase.from('series').select('id, name').order('ordenar', { ascending: true }),
          supabase.from('classes').select('id, name'),
        ]);

        const um: Record<string, string> = {};
        unitsRes.data?.forEach((u: { id: string; name: string }) => { um[u.id] = u.name; });
        setUnitMap(um);

        const sm: Record<string, string> = {};
        seriesRes.data?.forEach((s: { id: string; name: string }) => { sm[s.id] = s.name; });
        setSeriesMap(sm);

        const cm: Record<string, string> = {};
        classesRes.data?.forEach((c: { id: string; name: string }) => { cm[c.id] = c.name; });
        setClassMap(cm);
      } catch (err) {
        // Silenciar erro de lookup para não bloquear a aba
        console.warn('Falha ao carregar nomes de unidades/séries/turmas', err);
      }
    };

    fetchLookups();
  }, []);

  const fetchAssignedItems = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_list_items')
        .select(`
          *,
          students (*, classes(*, units(*), series(*)), student_phones(phone_number)),
          profiles (*),
          contact_lists (id, name, is_active, status_in, unit_ids, series_ids, class_ids, academic_years, exam_date_filters)
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
    const map = new Map<string, { listId: string; listName: string; items: AssignedItem[]; filters: ContactListFilters }>();
    for (const it of filtered) {
      const listId = it.list_id;
      const listName = it.contact_lists?.name || it.list_id;
      const key = listId;
      const prev = map.get(key);
      if (prev) {
        prev.items.push(it);
      } else {
        map.set(key, { listId, listName, items: [it], filters: it.contact_lists || null });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.listName.localeCompare(b.listName));
  }, [filtered]);

  const handleOpenNewTab = (studentId: string) => {
    window.open(`/student/${studentId}`, '_blank', 'noopener,noreferrer');
  };

  const handleRightClickOpen = (e: React.MouseEvent, studentId: string) => {
    e.preventDefault();
    handleOpenNewTab(studentId);
  };

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Veja suas listas e alunos atribuídos a você.</p>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-gray-100">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por aluno, unidade, série ou turma..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-w-0 pl-10"
              />
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="shrink-0 accent-primary"
                checked={showOnlyActive}
                onChange={(e) => setShowOnlyActive(e.target.checked)}
              />
              <span>Mostrar apenas ativos</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center text-gray-600">Carregando...</div>
      )}

      {!loading && grouped.length === 0 && (
        <Card className="border-0 shadow-sm ring-1 ring-gray-100">
          <CardHeader>
            <CardTitle className="text-base">Nenhum aluno designado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Você ainda não possui alunos designados.</p>
          </CardContent>
        </Card>
      )}

      {grouped.map(group => {
        const activeCount = group.items.filter(i => !i.left_at).length;
        const f = group.filters;
        const isCollapsed = collapsedLists[group.listId];
        const unitLabels = f?.unit_ids?.length ? f.unit_ids.map((id) => unitMap[id] || id) : [];
        const seriesLabels = f?.series_ids?.length ? f.series_ids.map((id) => seriesMap[id] || id) : [];
        const classLabels = f?.class_ids?.length ? f.class_ids.map((id) => classMap[id] || id) : [];
        const yearsLabels = f?.academic_years?.length ? f.academic_years : [];
        const statusLabels = f?.status_in?.length ? f.status_in : [];
        const examLabels = f?.exam_date_filters?.length ? f.exam_date_filters.map(formatExamFilter) : [];
        return (
          <Card key={group.listId} className="min-w-0 overflow-hidden border-0 shadow-sm ring-1 ring-gray-100">
            <CardHeader
              className="cursor-pointer space-y-3 border-b border-gray-100 pb-3 transition-colors hover:bg-gray-50/80"
              onClick={() => toggleCollapse(group.listId)}
            >
              <CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-primary" />
                  )}
                  <span className="break-words font-semibold text-gray-900">{group.listName}</span>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-primary">
                    Total: {group.items.length}
                  </span>
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">
                    Ativos: {activeCount}
                  </span>
                </div>
              </CardTitle>
              {(unitLabels.length || seriesLabels.length || classLabels.length || yearsLabels.length || statusLabels.length || examLabels.length) ? (
                <div className="flex flex-wrap gap-2">
                  {statusLabels.map((s, i) => (
                    <Badge key={`st-${i}`} variant="secondary" className="text-xs font-normal">Status: {s}</Badge>
                  ))}
                  {unitLabels.map((u, i) => (
                    <Badge key={`u-${i}`} variant="secondary" className="text-xs font-normal">Unidade: {u}</Badge>
                  ))}
                  {seriesLabels.map((s, i) => (
                    <Badge key={`se-${i}`} variant="secondary" className="text-xs">Série: {s}</Badge>
                  ))}
                  {classLabels.map((c, i) => (
                    <Badge key={`c-${i}`} variant="secondary" className="text-xs">Turma: {c}</Badge>
                  ))}
                  {yearsLabels.map((y, i) => (
                    <Badge key={`y-${i}`} variant="secondary" className="text-xs">Ano: {y}</Badge>
                  ))}
                  {examLabels.map((e, i) => (
                    <Badge key={`e-${i}`} variant="secondary" className="text-xs">{e}</Badge>
                  ))}
                </div>
              ) : null}
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="min-w-0 px-3 sm:px-6">
                <div className="space-y-3 md:hidden">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                    >
                      <p className="font-medium text-gray-900 break-words">
                        {item.students?.student_name || item.student_id}
                      </p>
                      <p className="text-sm text-gray-600 break-words">
                        {item.students?.classes?.units?.name || '-'} /{' '}
                        {item.students?.classes?.series?.name || '-'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleOpenNewTab(item.student_id)}
                        onContextMenu={(e) => handleRightClickOpen(e, item.student_id)}
                        title="Clique esquerdo ou direito para abrir em nova aba"
                      >
                        <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
                        Abrir ficha
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-gray-400">Aluno</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-gray-400">Unidade / Série</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-gray-400">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-transparent">
                          <TableCell className="py-3 font-medium text-gray-900">
                            {item.students?.student_name || item.student_id}
                          </TableCell>
                          <TableCell className="py-3 text-sm text-gray-600">
                            {item.students?.classes?.units?.name || '-'} /{' '}
                            {item.students?.classes?.series?.name || '-'}
                          </TableCell>
                          <TableCell className="py-3 text-sm">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-primary/25 text-primary hover:bg-primary/5"
                              onClick={() => handleOpenNewTab(item.student_id)}
                              onContextMenu={(e) => handleRightClickOpen(e, item.student_id)}
                              title="Clique esquerdo ou direito para abrir em nova aba"
                            >
                              <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
                              Abrir ficha
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default AssignedContactsTab;