import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Enums, Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Unit = Tables<'units'>;
type Serie = Tables<'series'>;
type Class = Tables<'classes'> & { units: Unit; series: Serie };

type ContactList = {
  id: string;
  name: string;
  status_in: Enums<'student_status'>[] | null;
  unit_ids: string[] | null;
  series_ids: string[] | null;
  class_ids: string[] | null;
  is_active: boolean;
};

type ContactListAssignee = {
  id: string;
  list_id: string;
  user_id: string;
  weight: number;
};

type ContactListItem = {
  id: string;
  list_id: string;
  student_id: string;
  assigned_user_id: string | null;
  entered_at: string;
  left_at: string | null;
  students?: Tables<'students'> & {
    classes?: Tables<'classes'> & { units?: Unit; series?: Serie };
    student_phones?: { phone_number: string }[];
  };
  profiles?: Tables<'profiles'>;
};

const ContactLists = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.profile === 'admin';

  const [lists, setLists] = useState<ContactList[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [listItems, setListItems] = useState<ContactListItem[]>([]);
  const [assignees, setAssignees] = useState<ContactListAssignee[]>([]);
  type ProfileWithUnit = Tables<'profiles'> & { units?: Tables<'units'> | null };
  const [profilesOptions, setProfilesOptions] = useState<ProfileWithUnit[]>([]);
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});

  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState<Enums<'student_status'>[]>([]);
  const [formUnitIds, setFormUnitIds] = useState<string[]>([]);
  const [formSerieIds, setFormSerieIds] = useState<string[]>([]);
  const [formAcademicYears, setFormAcademicYears] = useState<string[]>([]);
  const [formExamDateFilters, setFormExamDateFilters] = useState<string[]>([]);
  const [formClassIds, setFormClassIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Catálogos para filtros na criação
  const [availableAcademicYears, setAvailableAcademicYears] = useState<string[]>([]);
  const [availableExamDates, setAvailableExamDates] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchLists();
    fetchFiltersData();
    fetchAssignableProfiles();

    // Atualizar contadores de ativos em tempo real
    const channel = supabase
      .channel('contact_list_items_global')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contact_list_items'
      }, () => {
        if (lists.length) {
          fetchActiveCountsForLists(lists.map(l => l.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedList) return;
    fetchListDetails(selectedList.id);
    const channel = supabase
      .channel(`contact_list_items_${selectedList.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contact_list_items',
        filter: `list_id=eq.${selectedList.id}`
      }, () => {
        fetchListItems(selectedList.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedList?.id]);

  const fetchFiltersData = async () => {
    const [{ data: u }, { data: s }, { data: c }, { data: stu }] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('series').select('*').order('name'),
      supabase.from('classes').select('*, units(*), series(*)').order('name'),
      supabase.from('students').select('exam_date, ano_letivo').limit(1000),
    ]);
    setUnits(u || []);
    setSeries(s || []);
    setClasses((c || []) as Class[]);
    const years = Array.from(new Set((stu || []).map(r => String(r.ano_letivo)).filter(Boolean)));
    const dates = Array.from(new Set((stu || []).map(r => r.exam_date as string).filter(Boolean))).sort();
    setAvailableAcademicYears(years);
    setAvailableExamDates(dates);
  };

  const fetchAssignableProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, profile, unit_id, ativo, units(name)')
      .in('profile', ['entrevistador', 'direcao', 'admin'])
      .eq('ativo', true)
      .order('name');
    setProfilesOptions((data || []) as ProfileWithUnit[]);
  };

  const fetchLists = async () => {
    const { data, error } = await supabase
      .from('contact_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar listas');
      return;
    }
    const loaded = (data || []) as ContactList[];
    setLists(loaded);
    if (loaded.length) {
      fetchActiveCountsForLists(loaded.map(l => l.id));
    } else {
      setActiveCounts({});
    }
  };

  const fetchActiveCountsForLists = async (listIds: string[]) => {
    if (!listIds.length) {
      setActiveCounts({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('contact_list_items')
        .select('list_id')
        .in('list_id', listIds)
        .is('left_at', null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row: { list_id: string }) => {
        counts[row.list_id] = (counts[row.list_id] || 0) + 1;
      });
      setActiveCounts(counts);
    } catch (err) {
      console.warn('Falha ao carregar contagem de ativos por lista', err);
    }
  };

  const fetchListItems = async (listId: string) => {
    const { data, error } = await supabase
      .from('contact_list_items')
      .select(`
        *,
        students (*, classes(*, units(*), series(*)), student_phones(phone_number)),
        profiles (*)
      `)
      .eq('list_id', listId)
      .order('entered_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar itens da lista');
      return;
    }
    setListItems((data || []) as ContactListItem[]);
  };

  const fetchAssignees = async (listId: string) => {
    const { data, error } = await supabase
      .from('contact_list_assignees')
      .select('*')
      .eq('list_id', listId)
      .order('created_at');

    if (error) {
      toast.error('Erro ao carregar designados');
      return;
    }
    setAssignees((data || []) as ContactListAssignee[]);
  };

  const fetchListDetails = async (listId: string) => {
    await Promise.all([fetchListItems(listId), fetchAssignees(listId)]);
  };

  const handleCreateList = async () => {
    if (!formName.trim()) {
      toast.error('Informe um nome para a lista');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('contact_lists')
        .insert({
          name: formName.trim(),
          status_in: formStatus.length ? formStatus : null,
          unit_ids: formUnitIds.length ? formUnitIds : null,
          series_ids: formSerieIds.length ? formSerieIds : null,
          class_ids: formClassIds.length ? formClassIds : null,
          academic_years: formAcademicYears.length ? formAcademicYears : null,
          exam_date_filters: formExamDateFilters.length ? formExamDateFilters : null,
          created_by: profile?.id || null,
          is_active: true,
          distribution_mode: 'least_load'
        })
        .select('*')
        .single();

      if (error) throw error;
      toast.success('Lista criada');
      setFormName('');
      setFormStatus([]);
      setFormUnitIds([]);
      setFormSerieIds([]);
      setFormClassIds([]);
      setFormAcademicYears([]);
      setFormExamDateFilters([]);
      await fetchLists();
      setSelectedList(data as ContactList);
      await fetchListDetails((data as ContactList).id);
    } catch (err) {
      toast.error('Erro ao criar lista');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    const confirmed = window.confirm('Tem certeza que deseja excluir esta lista? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    try {
      const { error: eItems } = await supabase
        .from('contact_list_items')
        .delete()
        .eq('list_id', listId);
      if (eItems) throw eItems;

      const { error: eAssignees } = await supabase
        .from('contact_list_assignees')
        .delete()
        .eq('list_id', listId);
      if (eAssignees) throw eAssignees;

      const { error: eList } = await supabase
        .from('contact_lists')
        .delete()
        .eq('id', listId);
      if (eList) throw eList;

      toast.success('Lista excluída');
      await fetchLists();
      if (selectedList?.id === listId) {
        setSelectedList(null);
        setListItems([]);
        setAssignees([]);
      }
    } catch (err) {
      console.error('Erro ao excluir lista:', err);
      toast.error('Erro ao excluir lista');
    }
  };

  const handleAddAssignee = async (userId: string) => {
    if (!selectedList) return;
    const exists = assignees.some(a => a.user_id === userId);
    if (exists) {
      toast.info('Usuário já designado');
      return;
    }
    const { error } = await supabase
      .from('contact_list_assignees')
      .insert({
        list_id: selectedList.id,
        user_id: userId,
        weight: 1
      });

    if (error) {
      toast.error('Erro ao adicionar designado');
      return;
    }
    toast.success('Designado adicionado');
    try {
      await supabase.rpc('distribute_contact_list_items', { p_list_id: selectedList.id });
    } catch (e) {
      console.warn('Distribuição via RPC falhou (gatilho deve cobrir):', e);
    }
    fetchAssignees(selectedList.id);
    fetchListItems(selectedList.id);
  };

  const handleRemoveAssignee = async (userId: string) => {
    if (!selectedList) return;
    const { error } = await supabase
      .from('contact_list_assignees')
      .delete()
      .eq('list_id', selectedList.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Erro ao remover designado');
      return;
    }
    toast.success('Designado removido');
    fetchAssignees(selectedList.id);
  };

  const activeCount = useMemo(() => listItems.filter(i => !i.left_at).length, [listItems]);
  const lastEntries = useMemo(() => listItems.slice(0, 10), [listItems]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Listas de Contato</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Somente administradores podem acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Listas de Contato Dinâmicas</h2>
          <p className="text-gray-600">Crie listas com filtros e distribua para usuários. Atualiza em tempo real.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Criar Nova Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Label>Nome da Lista</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Follow-up: Ausentes 6º-9º Ano - Unidade Norte" />
            </div>

            <div>
              <Label>Status</Label>
              <MultiSelect
                options={[
                  { value: 'nao_confirmado', label: 'Não Confirmado' },
                  { value: 'confirmado', label: 'Confirmado' },
                  { value: 'cadastro_invalido', label: 'Cadastro Inválido' },
                  { value: 'matriculado', label: 'Matriculado' },
                  { value: 'desistente', label: 'Desistente' },
                  { value: 'nenhum_agendamento', label: 'Nenhum Agendamento' },
                  { value: 'atendimento_agendado', label: 'Atendimento Agendado' },
                  { value: 'faltou_ao_atendimento', label: 'Faltou ao Atendimento' },
                  { value: 'atendimento_recentemente', label: 'Atendimento Recentemente' },
                  { value: 'atendimento_ha_mais_de_uma_semana', label: 'Atendimento há mais de uma semana' },
                  { value: 'ausente', label: 'Ausente' }
                ]}
                selected={formStatus as unknown as string[]}
                onChange={(vals) => setFormStatus(vals as Enums<'student_status'>[])}
                placeholder="Status"
              />
            </div>

            <div>
              <Label>Unidade</Label>
              <MultiSelect
                options={units.filter(Boolean).map(unit => ({ value: unit.id, label: unit.name || 'Sem nome' }))}
                selected={formUnitIds}
                onChange={setFormUnitIds}
                placeholder="Unidade"
              />
            </div>

            <div>
              <Label>Série</Label>
              <MultiSelect
                options={series.filter(Boolean).map(_series => ({ value: _series.id, label: _series.name || 'Sem nome' }))}
                selected={formSerieIds}
                onChange={setFormSerieIds}
                placeholder="Série"
              />
            </div>

            <div>
              <Label>Data da Prova</Label>
              <MultiSelect
                options={[
                  { value: 'sem_data', label: 'Sem Data' },
                  { value: 'hoje', label: 'Hoje' },
                  { value: 'futuras', label: 'Futuras' },
                  { value: 'passadas', label: 'Passadas' },
                  ...availableExamDates.map(date => ({ value: `date_${date}`, label: date }))
                ]}
                selected={formExamDateFilters}
                onChange={setFormExamDateFilters}
                placeholder="Data da Prova"
              />
            </div>

            <div>
              <Label>Ano Letivo</Label>
              <MultiSelect
                options={availableAcademicYears.map(y => ({ value: String(y), label: String(y) }))}
                selected={formAcademicYears}
                onChange={setFormAcademicYears}
                placeholder="Ano Letivo"
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleCreateList} disabled={creating}>{creating ? 'Criando...' : 'Criar Lista'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead>Nº de Alunos</TableHead>
                <TableHead>Filtros</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>{l.is_active ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{activeCounts[l.id] ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.status_in?.length ? <Badge variant="outline">{l.status_in.join(', ')}</Badge> : <Badge variant="secondary">Todos status</Badge>}
                    {' '}
                    {l.unit_ids?.length ? <Badge variant="outline">{l.unit_ids.length} unidade(s)</Badge> : <Badge variant="secondary">Todas unidades</Badge>}
                    {' '}
                    {l.series_ids?.length ? <Badge variant="outline">{l.series_ids.length} série(s)</Badge> : <Badge variant="secondary">Todas séries</Badge>}
                    {' '}
                    {l.class_ids?.length ? <Badge variant="outline">{l.class_ids.length} turma(s)</Badge> : <Badge variant="secondary">Todas turmas</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => setSelectedList(l)}>Abrir</Button>
                    <Button variant="destructive" className="ml-2" onClick={() => handleDeleteList(l.id)}>Excluir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedList && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes: {selectedList.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <h3 className="font-semibold mb-2">Designados</h3>
                <div className="space-y-2">
                  {assignees.map(a => {
                    const p = profilesOptions.find(x => x.id === a.user_id);
                    return (
                      <div key={a.user_id} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <div className="font-medium">{p?.name || a.user_id}</div>
                          <div className="text-xs text-gray-500">{p?.units?.name || p?.profile}</div>                          
                        </div>
                        <Button variant="destructive" onClick={() => handleRemoveAssignee(a.user_id)}>Remover</Button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <Label>Adicionar Designado</Label>
                  <Select onValueChange={(userId) => handleAddAssignee(userId)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar usuário" /></SelectTrigger>
                    <SelectContent>
                      {profilesOptions.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {p.units?.name || p.profile}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Itens da Lista</h3>
                  <Badge variant="outline">Ativos: {activeCount}</Badge>
                </div>

                <div className="mt-2 text-sm text-gray-600">Quem entrou por último:</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {lastEntries.map(e => (
                    <Badge key={e.id} variant={e.left_at ? 'secondary' : 'default'}>
                      {e.students?.student_name || e.student_id} — {new Date(e.entered_at).toLocaleString('pt-BR')}
                    </Badge>
                  ))}
                </div>

                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Unidade / Série / Turma</TableHead>
                        <TableHead>Designado</TableHead>
                        <TableHead>Entrou</TableHead>
                        <TableHead>Saiu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.students?.student_name || item.student_id}</TableCell>
                          <TableCell className="text-sm">{item.students?.classes?.units?.name || '-'} / {item.students?.classes?.series?.name || '-'} / {item.students?.classes?.name || '-'}</TableCell>
                          <TableCell className="text-sm">{item.profiles?.name || item.assigned_user_id || '-'}</TableCell>
                          <TableCell className="text-sm">{new Date(item.entered_at).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-sm">{item.left_at ? new Date(item.left_at).toLocaleString('pt-BR') : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContactLists;