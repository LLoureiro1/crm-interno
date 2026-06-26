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
const DEFAULT_PERIODO_ID = '11';

type AuthMode = 'token' | 'bearer';
type SophiaRow = { codigo_externo: string; nome: string; periodo_id: string; synced_at: string };

type RequestBody = {
  pagina?: number;
  reset?: boolean;
  authMode?: AuthMode;
};

function log(step: string, detail?: Record<string, unknown>) {
  console.log(`[sophia-api] ${step}`, detail ?? '');
}

function getPeriodoId(): string {
  const periodoId = Deno.env.get('SOPHIA_PERIODO_ID')?.trim() || DEFAULT_PERIODO_ID;
  if (!/^\d+$/.test(periodoId)) {
    throw new Error(`SOPHIA_PERIODO_ID inválido: "${periodoId}"`);
  }
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

async function sophiaAuthenticate(baseUrl: string, usuario: string, senha: string): Promise<string> {
  const response = await fetch(`${baseUrl}/Autenticacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ usuario, senha }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Falha na autenticação SophiA (${response.status}): ${body.slice(0, 200)}`);
  }

  return body.trim().replace(/^"|"$/g, '');
}

function parseAlunosPage(payload: unknown): { rawCount: number; rows: SophiaRow[]; periodoId: string } {
  const periodoId = getPeriodoId();
  const syncedAt = new Date().toISOString();
  let raw: unknown[] = [];

  if (Array.isArray(payload)) {
    raw = payload;
  } else if (payload && typeof payload === 'object') {
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

  return { rawCount: raw.length, rows, periodoId };
}

async function fetchAlunosPage(
  baseUrl: string,
  token: string,
  pagina: number,
  authMode: AuthMode,
  periodoId: string,
) {
  const url = `${baseUrl}/Alunos?Periodos=${periodoId}&pagina=${pagina}&tamanho=${PAGE_SIZE}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    ...(authMode === 'bearer' ? { Authorization: `Bearer ${token}` } : { token }),
  };

  log('alunos_request', { pagina, authMode, periodoId });
  const response = await fetch(url, { headers });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao listar alunos SophiA (${response.status}): ${body.slice(0, 200)}`);
  }

  return parseAlunosPage(JSON.parse(body));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const pagina = typeof body.pagina === 'number' && body.pagina >= 0 ? body.pagina : 0;
    const reset = body.reset === true;
    let authMode: AuthMode = body.authMode === 'bearer' ? 'bearer' : 'token';
    const periodoId = getPeriodoId();

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Não autorizado' }, 401);

    const { data: profile } = await supabaseUser.from('profiles').select('profile').eq('id', user.id).single();
    if (profile?.profile !== 'admin') {
      return jsonResponse({ error: 'Acesso restrito a administradores' }, 403);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (reset && pagina === 0) {
      log('sync_reset', { periodoId });
      await supabaseAdmin.from('sophia_students').delete().eq('periodo_id', periodoId);
      await supabaseAdmin.from('sophia_sync_meta').upsert({
        periodo_id: periodoId,
        status: 'syncing',
        synced_at: null,
        total_students: 0,
      });
    }

    const baseUrl = requireEnv('SOPHIA_API_BASE_URL').replace(/\/$/, '');
    const token = await sophiaAuthenticate(baseUrl, requireEnv('SOPHIA_API_USUARIO'), requireEnv('SOPHIA_API_SENHA'));

    let page;
    try {
      page = await fetchAlunosPage(baseUrl, token, pagina, authMode, periodoId);
    } catch (error) {
      if (authMode === 'token') {
        authMode = 'bearer';
        page = await fetchAlunosPage(baseUrl, token, pagina, authMode, periodoId);
      } else {
        throw error;
      }
    }

    if (page.rows.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('sophia_students')
        .upsert(page.rows, { onConflict: 'codigo_externo,periodo_id' });

      if (upsertError) throw upsertError;
    }

    const done = page.rawCount < PAGE_SIZE;
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
        total_students: count ?? page.rows.length,
      });
    }

    log('sync_page_ok', { pagina, upserted: page.rows.length, done, nextPagina });

    return jsonResponse({
      pagina,
      nextPagina,
      done,
      upserted: page.rows.length,
      periodoId,
      authMode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar SophiA';
    log('fatal', { message });
    return jsonResponse({ error: message }, 500);
  }
});
