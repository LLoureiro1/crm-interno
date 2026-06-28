import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, CloudDownload, Loader2, RefreshCw, XCircle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type CrmStudent = {
  id: string;
  student_name: string;
  codigo_erp: string | null;
  units?: { name: string } | null;
};

type SophiaStudent = Pick<Tables<'sophia_students'>, 'codigo_externo' | 'nome'>;
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
  nextPagina?: number | null;
  done?: boolean;
  upserted?: number;
  authMode?: 'token' | 'bearer';
  error?: string;
};

const SOPHIA_IN_CHUNK = 200;

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeErpCode(value: string): string {
  return value.trim().replace(/^0+/, '') || '0';
}

function statusLabel(status: ReconciliationStatus): string {
  if (status === 'ok') return 'Conferido';
  if (status === 'name_mismatch') return 'Nome divergente';
  return 'Não encontrado no SophiA';
}

function formatSyncedAt(value: string | null | undefined): string {
  if (!value) return 'nunca';
  return new Date(value).toLocaleString('pt-BR');
}

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

async function syncSophiaToDatabase(onProgress: (pagina: number) => void): Promise<void> {
  let pagina = 0;
  let reset = true;
  let authMode: 'token' | 'bearer' = 'token';

  while (true) {
    const data = await invokeSophiaSync({ pagina, reset, authMode });
    onProgress(pagina);

    if (data.done || data.nextPagina == null) break;

    pagina = data.nextPagina;
    reset = false;
    authMode = data.authMode === 'bearer' ? 'bearer' : 'token';
  }
}

async function fetchSophiaStudentsForCodes(
  codes: string[],
  periodoId: string,
): Promise<SophiaStudent[]> {
  if (codes.length === 0) return [];

  const uniqueCodes = [...new Set(codes)];
  const results: SophiaStudent[] = [];

  for (let i = 0; i < uniqueCodes.length; i += SOPHIA_IN_CHUNK) {
    const chunk = uniqueCodes.slice(i, i + SOPHIA_IN_CHUNK);
    const { data, error } = await supabase
      .from('sophia_students')
      .select('codigo_externo, nome')
      .eq('periodo_id', periodoId)
      .in('codigo_externo', chunk);

    if (error) throw error;
    results.push(...((data || []) as SophiaStudent[]));
  }

  return results;
}

function buildReconciliationRows(
  students: CrmStudent[],
  sophiaStudents: SophiaStudent[],
): { rows: ReconciliationRow[]; missingErpCount: number } {
  const sophiaByCode = new Map<string, SophiaStudent>();
  for (const aluno of sophiaStudents) {
    const key = normalizeErpCode(aluno.codigo_externo);
    sophiaByCode.set(key, aluno);
    sophiaByCode.set(aluno.codigo_externo.trim(), aluno);
  }

  const withErp = students.filter((student) => student.codigo_erp?.trim());
  const rows = withErp.map((student) => {
    const codigoErp = student.codigo_erp!.trim();
    const sophiaMatch =
      sophiaByCode.get(normalizeErpCode(codigoErp)) ?? sophiaByCode.get(codigoErp) ?? null;
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
  });

  return { rows, missingErpCount: students.length - withErp.length };
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

export const SophiaEnrollmentReconciliation = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncPage, setSyncPage] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [missingErpCount, setMissingErpCount] = useState(0);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [syncMeta, setSyncMeta] = useState<SophiaSyncMeta | null>(null);
  const hasLoadedOnce = useRef(false);

  const runReconciliation = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent && hasLoadedOnce.current) {
      setRefreshing(true);
    } else if (!hasLoadedOnce.current) {
      setInitialLoading(true);
    }

    try {
      const { data: meta, error: metaError } = await supabase
        .from('sophia_sync_meta')
        .select('*')
        .maybeSingle();

      if (metaError) throw metaError;
      setSyncMeta(meta);

      const periodoId = meta?.periodo_id ?? '11';

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, student_name, codigo_erp, units(name)')
        .eq('status', 'matriculado')
        .order('student_name');

      if (studentsError) throw studentsError;

      const crmStudents = (students || []) as CrmStudent[];
      const erpCodes = crmStudents
        .map((s) => s.codigo_erp?.trim())
        .filter((c): c is string => Boolean(c));

      const sophiaStudents = await fetchSophiaStudentsForCodes(erpCodes, periodoId);
      const result = buildReconciliationRows(crmStudents, sophiaStudents);

      setMissingErpCount(result.missingErpCount);
      setRows(result.rows);
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error('Erro na conferência SophiA:', error);
      const message = error instanceof Error ? error.message : 'Erro ao carregar conferência';
      toast.error(message);
      setRows([]);
      setMissingErpCount(0);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleImportFromSophia = useCallback(async () => {
    setSyncing(true);
    setSyncPage(0);

    try {
      await syncSophiaToDatabase((pagina) => setSyncPage(pagina));
      toast.success('Importação do SophiA concluída');
      await runReconciliation({ silent: true });
    } catch (error) {
      console.error('Erro ao importar SophiA:', error);
      const message = error instanceof Error ? error.message : 'Erro ao importar SophiA';
      toast.error(message);
    } finally {
      setSyncing(false);
      setSyncPage(null);
    }
  }, [runReconciliation]);

  useEffect(() => {
    void runReconciliation();
  }, [runReconciliation]);

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

  const busy = initialLoading || refreshing || syncing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            onClick={() => void runReconciliation()}
            disabled={busy}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar conferência
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleImportFromSophia()}
            disabled={busy}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="mr-2 h-4 w-4" />
            )}
            {syncing ? `Importando pág. ${(syncPage ?? 0) + 1}...` : 'Importar do SophiA'}
          </Button>
        </div>
      </div>

      {!syncMeta?.synced_at && !initialLoading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Cache vazio. Use &quot;Importar do SophiA&quot; uma vez; depois &quot;Atualizar conferência&quot; compara só com o banco local.
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

      {initialLoading ? (
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
