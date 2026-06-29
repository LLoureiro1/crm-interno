/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

const PAGE_SIZE = 200;
const IN_QUERY_CHUNK = 40;
const TOKEN_TTL_MS = 25 * 60 * 1000;
const DEFAULT_PERIODO_ID = '11';
const DEFAULT_MAX_STUDENTS = 4000;

function getMaxCatalogPages(): number {
  const maxStudents = parseInt(Deno.env.get('SOPHIA_MAX_STUDENTS') ?? String(DEFAULT_MAX_STUDENTS), 10);
  const safeMax = Number.isFinite(maxStudents) && maxStudents > 0 ? maxStudents : DEFAULT_MAX_STUDENTS;
  return Math.ceil(safeMax / PAGE_SIZE) + 2;
}

type AuthMode = 'token' | 'bearer';
type SophiaRow = { codigo_externo: string; nome: string; periodo_id: string; synced_at: string };

type RequestBody = {
  mode?: 'reconcile' | 'full' | 'incremental';
  codes?: string[];
  pendingCodes?: string[];
  pagina?: number;
  authMode?: AuthMode;
  reset?: boolean;
};

type SyncMetaRow = {
  auth_token: string | null;
  auth_mode: string | null;
  token_cached_at: string | null;
};

function getPeriodoId(): string {
  const periodoId = Deno.env.get('SOPHIA_PERIODO_ID')?.trim() || DEFAULT_PERIODO_ID;
  if (!/^\d+$/.test(periodoId)) throw new Error(`SOPHIA_PERIODO_ID inválido: "${periodoId}"`);
  return periodoId;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variável ${name} não configurada no servidor`);
  return value;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeErpCode(value: string): string {
  return value.trim().replace(/^0+/, '') || '0';
}

function codeMatches(a: string, b: string): boolean {
  const ta = a.trim();
  const tb = b.trim();
  return ta === tb || normalizeErpCode(ta) === normalizeErpCode(tb);
}

function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === 'object') {
    const err = value as Record<string, unknown>;
    const parts = [err.message, err.details, err.hint, err.code].filter(Boolean).map(String);
    if (parts.length > 0) return new Error(parts.join(' — '));
  }
  return new Error(fallback);
}

async function sophiaAuthenticate(baseUrl: string, usuario: string, senha: string): Promise<string> {
  const response = await fetch(`${baseUrl}/Autenticacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ usuario, senha }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Falha na autenticação SophiA (${response.status}): ${body.slice(0, 200)}`);
  return body.trim().replace(/^"|"$/g, '');
}

function parseAlunosPage(payload: unknown, periodoId: string, syncedAt: string): { rawCount: number; rows: SophiaRow[] } {
  let raw: unknown[] = [];
  if (Array.isArray(payload)) raw = payload;
  else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidate = record.items ?? record.data ?? record.alunos ?? record.Alunos ?? record.resultado;
    if (Array.isArray(candidate)) raw = candidate;
  }

  const rows = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const aluno = item as Record<string, unknown>;
      const codigoExterno = aluno.codigoExterno ?? aluno.CodigoExterno;
      const nome = aluno.nome ?? aluno.Nome;
      if (codigoExterno == null || nome == null) return null;
      return {
        codigo_externo: String(codigoExterno).trim(),
        nome: String(nome).trim(),
        periodo_id: periodoId,
        synced_at: syncedAt,
      };
    })
    .filter((item): item is SophiaRow => Boolean(item?.codigo_externo));

  return { rawCount: raw.length, rows };
}

function isCatalogEnded(
  page: { rawCount: number; rows: SophiaRow[] },
  pagina: number,
): { ended: boolean; reason: 'natural' | 'empty_page' | 'max_pages' | null } {
  if (pagina + 1 >= getMaxCatalogPages()) return { ended: true, reason: 'max_pages' };
  if (page.rawCount === 0 || page.rawCount < PAGE_SIZE) return { ended: true, reason: 'natural' };
  if (page.rows.length === 0) return { ended: true, reason: 'empty_page' };
  return { ended: false, reason: null };
}

async function fetchAlunosPage(
  baseUrl: string,
  token: string,
  pagina: number,
  authMode: AuthMode,
  periodoId: string,
  syncedAt: string,
): Promise<{ page: { rawCount: number; rows: SophiaRow[] }; authMode: AuthMode }> {
  const url = `${baseUrl}/Alunos?Periodos=${periodoId}&pagina=${pagina}&tamanho=${PAGE_SIZE}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    ...(authMode === 'bearer' ? { Authorization: `Bearer ${token}` } : { token }),
  };

  const response = await fetch(url, { headers });
  const body = await response.text();

  if (response.status === 401 && authMode === 'token') {
    return fetchAlunosPage(baseUrl, token, pagina, 'bearer', periodoId, syncedAt);
  }

  if (!response.ok) throw new Error(`Falha ao listar alunos SophiA (${response.status}): ${body.slice(0, 200)}`);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`Resposta inválida da API SophiA: ${body.slice(0, 200)}`);
  }

  return { page: parseAlunosPage(payload, periodoId, syncedAt), authMode };
}

async function getCachedToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  periodoId: string,
  baseUrl: string,
  forceRefresh = false,
): Promise<{ token: string; authMode: AuthMode }> {
  if (!forceRefresh) {
    const { data: meta, error: metaError } = await supabaseAdmin
      .from('sophia_sync_meta')
      .select('auth_token, auth_mode, token_cached_at')
      .eq('periodo_id', periodoId)
      .maybeSingle();

    if (!metaError) {
      const row = meta as SyncMetaRow | null;
      if (row?.auth_token && row.token_cached_at) {
        const age = Date.now() - new Date(row.token_cached_at).getTime();
        if (age < TOKEN_TTL_MS) {
          return {
            token: row.auth_token,
            authMode: row.auth_mode === 'bearer' ? 'bearer' : 'token',
          };
        }
      }
    }
  }

  const token = await sophiaAuthenticate(
    baseUrl,
    requireEnv('SOPHIA_API_USUARIO'),
    requireEnv('SOPHIA_API_SENHA'),
  );

  const { error: cacheError } = await supabaseAdmin.from('sophia_sync_meta').upsert({
    periodo_id: periodoId,
    auth_token: token,
    auth_mode: 'token',
    token_cached_at: new Date().toISOString(),
  });

  if (cacheError) {
    await supabaseAdmin.from('sophia_sync_meta').upsert({ periodo_id: periodoId });
  }

  return { token, authMode: 'token' };
}

async function saveTokenCache(
  supabaseAdmin: ReturnType<typeof createClient>,
  periodoId: string,
  token: string,
  authMode: AuthMode,
) {
  const { error: cacheError } = await supabaseAdmin.from('sophia_sync_meta').upsert({
    periodo_id: periodoId,
    auth_token: token,
    auth_mode: authMode,
    token_cached_at: new Date().toISOString(),
  });

  if (cacheError) {
    await supabaseAdmin.from('sophia_sync_meta').upsert({ periodo_id: periodoId });
  }
}

function dedupeByCodigo(rows: SophiaRow[]): SophiaRow[] {
  const map = new Map<string, SophiaRow>();
  for (const row of rows) map.set(row.codigo_externo, row);
  return [...map.values()];
}

function filterRowsForPending(pageRows: SophiaRow[], pendingCodes: string[]): SophiaRow[] {
  if (pendingCodes.length === 0) return [];
  return pageRows.filter((row) => pendingCodes.some((code) => codeMatches(code, row.codigo_externo)));
}

function removeFoundFromPending(pendingCodes: string[], matched: SophiaRow[]): string[] {
  return pendingCodes.filter((code) => !matched.some((row) => codeMatches(code, row.codigo_externo)));
}

async function fetchExistingCodes(
  supabaseAdmin: ReturnType<typeof createClient>,
  periodoId: string,
  codes: string[],
): Promise<Set<string>> {
  const known = new Set<string>();
  if (codes.length === 0) return known;

  for (let i = 0; i < codes.length; i += IN_QUERY_CHUNK) {
    const chunk = codes.slice(i, i + IN_QUERY_CHUNK);
    const { data: existing, error } = await supabaseAdmin
      .from('sophia_students')
      .select('codigo_externo')
      .eq('periodo_id', periodoId)
      .in('codigo_externo', chunk);

    if (error) throw toError(error, 'Falha ao consultar cache local');

    for (const row of existing ?? []) {
      known.add(row.codigo_externo.trim());
      known.add(normalizeErpCode(row.codigo_externo));
    }
  }

  return known;
}

async function filterNewRowsOnPage(
  supabaseAdmin: ReturnType<typeof createClient>,
  periodoId: string,
  pageRows: SophiaRow[],
): Promise<SophiaRow[]> {
  if (pageRows.length === 0) return [];

  const codes = [...new Set(pageRows.map((row) => row.codigo_externo.trim()).filter(Boolean))];
  if (codes.length === 0) return [];

  const known = await fetchExistingCodes(supabaseAdmin, periodoId, codes);
  return pageRows.filter((row) => !isRowKnown(row, known));
}

function isRowKnown(row: SophiaRow, known: Set<string>): boolean {
  return known.has(row.codigo_externo) || known.has(normalizeErpCode(row.codigo_externo));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const mode =
      body.mode === 'full' ? 'full' : body.mode === 'incremental' ? 'incremental' : 'reconcile';
    const pagina = Math.max(0, body.pagina ?? 0);
    let authMode: AuthMode = body.authMode === 'bearer' ? 'bearer' : 'token';
    const periodoId = getPeriodoId();
    const syncedAt = new Date().toISOString();

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Não autorizado' }, 401);

    const { data: profile } = await supabaseUser.from('profiles').select('profile').eq('id', user.id).single();
    if (profile?.profile !== 'admin') return jsonResponse({ error: 'Acesso restrito a administradores' }, 403);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const baseUrl = requireEnv('SOPHIA_API_BASE_URL').replace(/\/$/, '');

    if (mode === 'full' && body.reset === true && pagina === 0) {
      await supabaseAdmin.from('sophia_students').delete().eq('periodo_id', periodoId);
    }

    if (pagina === 0) {
      await supabaseAdmin.from('sophia_sync_meta').upsert({
        periodo_id: periodoId,
        status: 'syncing',
      });
    }

    const { token: initialToken, authMode: initialAuthMode } = await getCachedToken(
      supabaseAdmin,
      periodoId,
      baseUrl,
      false,
    );
    let token = initialToken;
    authMode = body.authMode ?? initialAuthMode;

    let pageResult;
    try {
      pageResult = await fetchAlunosPage(baseUrl, token, pagina, authMode, periodoId, syncedAt);
    } catch (firstError) {
      const refreshed = await getCachedToken(supabaseAdmin, periodoId, baseUrl, true);
      token = refreshed.token;
      authMode = refreshed.authMode;
      try {
        pageResult = await fetchAlunosPage(baseUrl, token, pagina, authMode, periodoId, syncedAt);
      } catch {
        throw toError(firstError, 'Falha ao consultar API SophiA');
      }
    }

    authMode = pageResult.authMode;
    await saveTokenCache(supabaseAdmin, periodoId, token, authMode);

    const { page } = pageResult;
    let toUpsert: SophiaRow[] = [];
    let pendingCodes: string[] = [];
    let found = 0;
    let newCount = 0;

    if (mode === 'incremental') {
      toUpsert = dedupeByCodigo(await filterNewRowsOnPage(supabaseAdmin, periodoId, page.rows));
      newCount = toUpsert.length;
      found = toUpsert.length;
    } else if (mode === 'reconcile') {
      const allCodes = (body.codes ?? []).map((c) => c.trim()).filter(Boolean);
      pendingCodes = (body.pendingCodes ?? allCodes).map((c) => c.trim()).filter(Boolean);
      toUpsert = filterRowsForPending(page.rows, pendingCodes);
      found = toUpsert.length;
      pendingCodes = removeFoundFromPending(pendingCodes, toUpsert);
    } else {
      toUpsert = page.rows;
    }

    let changed = 0;
    if (toUpsert.length > 0) {
      if (mode === 'incremental') {
        for (let i = 0; i < toUpsert.length; i += IN_QUERY_CHUNK) {
          const chunk = toUpsert.slice(i, i + IN_QUERY_CHUNK);
          const { error: insertError } = await supabaseAdmin
            .from('sophia_students')
            .upsert(chunk, { onConflict: 'codigo_externo,periodo_id', ignoreDuplicates: true });
          if (insertError) throw toError(insertError, 'Falha ao gravar alunos novos');
        }
      } else {
        const { error: upsertError } = await supabaseAdmin
          .from('sophia_students')
          .upsert(toUpsert, { onConflict: 'codigo_externo,periodo_id' });
        if (upsertError) throw toError(upsertError, 'Falha ao gravar alunos');
      }
      changed = toUpsert.length;
    }

    const { ended: catalogEnded, reason: stopReason } = isCatalogEnded(page, pagina);
    const incrementalDone = mode === 'incremental' && catalogEnded;
    const reconcileDone = mode === 'reconcile' && (pendingCodes.length === 0 || catalogEnded);
    const fullDone = mode === 'full' && catalogEnded;
    const done = incrementalDone || reconcileDone || fullDone;
    const nextPagina = done ? null : pagina + 1;

    if (done) {
      const { count } = await supabaseAdmin
        .from('sophia_students')
        .select('*', { count: 'exact', head: true })
        .eq('periodo_id', periodoId);

      await supabaseAdmin.from('sophia_sync_meta').upsert({
        periodo_id: periodoId,
        status: 'idle',
        synced_at: new Date().toISOString(),
        total_students: count ?? 0,
      });
    }

    return jsonResponse({
      mode,
      done,
      pagina,
      nextPagina,
      changed,
      found,
      newCount: mode === 'incremental' ? newCount : undefined,
      pendingCodes: mode === 'reconcile' ? pendingCodes : undefined,
      pendingCount: mode === 'reconcile' ? pendingCodes.length : undefined,
      authMode,
      periodoId,
      pageRows: page.rows.length,
      rawCount: page.rawCount,
      pageSize: PAGE_SIZE,
      maxPages: getMaxCatalogPages(),
      stopReason: done ? stopReason : null,
    });
  } catch (error) {
    console.error('sophia-api error:', error);
    const message = toError(error, 'Erro ao sincronizar SophiA').message;
    return jsonResponse({ error: message }, 500);
  }
});
