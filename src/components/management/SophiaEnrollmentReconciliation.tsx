import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type CrmStudent = {
  id: string;
  student_name: string;
  code: string | null;
  codigo_erp: string | null;
  units?: { name: string } | null;
};

type SophiaStudent = Tables<'sophia_students'>;
type SophiaSyncMeta = Tables<'sophia_sync_meta'>;

type ReconciliationStatus = 'ok' | 'name_mismatch' | 'not_found';

type ReconciliationRow = {
  id: string;
  codigoErp: string;
  crmName: string;
  sophiaName: string | null;
  unitName: string;
  status: ReconciliationStatus;
};

type FilterOption = 'all' | 'issues' | 'ok';

type SyncPageResponse = {
  pagina?: number;
  nextPagina?: number | null;
  done?: boolean;
  upserted?: number;
  periodoId?: string;
  authMode?: 'token' | 'bearer';
  error?: string;
};

async function invokeSophiaSync(body: Record<string, unknown>): Promise<SyncPageResponse> {
  const { data, error } = await supabase.functions.invoke('sophia-api', { body });

  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json();
        message = payload?.error || payload?.message || message;
      } catch {
        /* mantém message original */
      }
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data as SyncPageResponse;
}

async function syncSophiaToDatabase(
  onProgress: (pagina: number, upserted: number) => void,
): Promise<void> {
  let pagina = 0;
  let reset = true;
  let authMode: 'token' | 'bearer' = 'token';

  while (true) {
    const data = await invokeSophiaSync({ pagina, reset, authMode });
    onProgress(pagina, data.upserted ?? 0);

    if (data.done || data.nextPagina == null) break;

    pagina = data.nextPagina;
    reset = false;
    authMode = data.authMode === 'bearer' ? 'bearer' : 'token';
  }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function statusLabel(status: ReconciliationStatus): string {
  if (status === 'ok') return 'Conferido';
  if (status === 'name_mismatch') return 'Nome divergente';
  return 'Não encontrado no SophiA';
}

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  if (status === 'ok') {
    return (
      <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {statusLabel(status)}
      </Badge>
    );
  }

  if (status === 'name_mismatch') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
        <AlertCircle className="h-3.5 w-3.5" />
        {statusLabel(status)}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </Badge>
  );
}

function formatSyncedAt(value: string | null | undefined): string {
  if (!value) return 'nunca';
  return new Date(value).toLocaleString('pt-BR');
}

export const SophiaEnrollmentReconciliation = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncPage, setSyncPage] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [missingErpCount, setMissingErpCount] = useState(0);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [syncMeta, setSyncMeta] = useState<SophiaSyncMeta | null>(null);

  const buildReconciliation = useCallback(
    (students: CrmStudent[], sophiaStudents: SophiaStudent[]) => {
      const sophiaByCode = new Map<string, SophiaStudent>();
      for (const aluno of sophiaStudents) {
        sophiaByCode.set(aluno.codigo_externo.trim(), aluno);
      }

      const withErp = students.filter((student) => student.codigo_erp?.trim());
      setMissingErpCount(students.length - withErp.length);

      setRows(
        withErp.map((student) => {
          const codigoErp = student.codigo_erp!.trim();
          const sophiaMatch = sophiaByCode.get(codigoErp) ?? null;
          let status: ReconciliationStatus = 'not_found';

          if (sophiaMatch) {
            status =
              normalizeName(student.student_name) === normalizeName(sophiaMatch.nome)
                ? 'ok'
                : 'name_mismatch';
          }

          return {
            id: student.id,
            codigoErp,
            crmName: student.student_name,
            sophiaName: sophiaMatch?.nome ?? null,
            unitName: student.units?.name || '—',
            status,
          };
        }),
      );
    },
    [],
  );

  const loadReconciliation = useCallback(async () => {
    setLoading(true);

    try {
      const [studentsResult, sophiaResult, metaResult] = await Promise.all([
        supabase
          .from('students')
          .select('id, student_name, code, codigo_erp, units(name)')
          .eq('status', 'matriculado')
          .order('student_name'),
        supabase.from('sophia_students').select('*'),
        supabase.from('sophia_sync_meta').select('*').maybeSingle(),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (sophiaResult.error) throw sophiaResult.error;
      if (metaResult.error) throw metaResult.error;

      setSyncMeta(metaResult.data);
      buildReconciliation(
        (studentsResult.data || []) as CrmStudent[],
        (sophiaResult.data || []) as SophiaStudent[],
      );
    } catch (error) {
      console.error('Erro na conferência SophiA:', error);
      const message = error instanceof Error ? error.message : 'Erro ao carregar conferência';
      toast.error(message);
      setRows([]);
      setMissingErpCount(0);
      setSyncMeta(null);
    } finally {
      setLoading(false);
    }
  }, [buildReconciliation]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncPage(0);

    try {
      await syncSophiaToDatabase((pagina) => setSyncPage(pagina));
      toast.success('Sincronização com SophiA concluída');
      await loadReconciliation();
    } catch (error) {
      console.error('Erro ao sincronizar SophiA:', error);
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar SophiA';
      toast.error(message);
    } finally {
      setSyncing(false);
      setSyncPage(null);
    }
  }, [loadReconciliation]);

  useEffect(() => {
    void loadReconciliation();
  }, [loadReconciliation]);

  const summary = useMemo(() => {
    const ok = rows.filter((row) => row.status === 'ok').length;
    const nameMismatch = rows.filter((row) => row.status === 'name_mismatch').length;
    const notFound = rows.filter((row) => row.status === 'not_found').length;
    return { ok, nameMismatch, notFound, total: rows.length };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (filter === 'ok') return rows.filter((row) => row.status === 'ok');
    if (filter === 'issues') return rows.filter((row) => row.status !== 'ok');
    return rows;
  }, [filter, rows]);

  const busy = loading || syncing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Compare o código ERP do CRM com o cache local do SophiA (período letivo 2026,{' '}
          <code className="text-xs">Periodos=11</code>). Última sincronização:{' '}
          {formatSyncedAt(syncMeta?.synced_at)}
          {syncMeta?.total_students ? ` · ${syncMeta.total_students} alunos no cache` : ''}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="default" onClick={() => void handleSync()} disabled={busy}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {syncing ? `Sincronizando pág. ${(syncPage ?? 0) + 1}...` : 'Sincronizar SophiA'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadReconciliation()} disabled={busy}>
            Atualizar conferência
          </Button>
        </div>
      </div>

      {!syncMeta?.synced_at && !loading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma sincronização encontrada. Clique em &quot;Sincronizar SophiA&quot; para importar os alunos do período.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{summary.total} com código ERP</Badge>
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{summary.ok} conferidos</Badge>
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
          {summary.nameMismatch} nomes divergentes
        </Badge>
        <Badge variant="destructive">{summary.notFound} não encontrados</Badge>
        {missingErpCount > 0 && (
          <Badge variant="outline">{missingErpCount} matriculados sem código ERP</Badge>
        )}
      </div>

      {missingErpCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Existem {missingErpCount} aluno(s) matriculado(s) sem código ERP preenchido no CRM.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={filter} onValueChange={(value) => setFilter(value as FilterOption)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="issues">Somente divergências</SelectItem>
            <SelectItem value="ok">Somente conferidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando conferência...
        </div>
      ) : visibleRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro para exibir.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código ERP</TableHead>
                <TableHead>Nome no CRM</TableHead>
                <TableHead>Nome no SophiA</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.id} className={row.status !== 'ok' ? 'bg-amber-50/40' : undefined}>
                  <TableCell className="font-mono text-sm">{row.codigoErp}</TableCell>
                  <TableCell>{row.crmName}</TableCell>
                  <TableCell className={row.sophiaName ? '' : 'text-muted-foreground italic'}>
                    {row.sophiaName ?? '—'}
                  </TableCell>
                  <TableCell>{row.unitName}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
