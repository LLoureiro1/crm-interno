/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action = 'status' | 'connect' | 'create' | 'logout' | 'setupWebhook';

type RequestBody = {
  action?: Action;
  instanceName?: string;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variável ${name} não configurada no servidor`);
  return value;
}

function assertReachableEvolutionUrl(url: string) {
  if (/localhost|127\.0\.0\.1|host\.docker\.internal/i.test(url)) {
    throw new Error(
      'EVOLUTION_API_URL aponta para localhost. A Edge Function roda na nuvem Supabase e não alcança o Docker da sua máquina. Em dev use npm run dev (proxy local). Em produção use uma URL pública (ngrok ou VPS).',
    );
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function defaultInstanceName(override?: string): string {
  return override?.trim() || Deno.env.get('EVOLUTION_INSTANCE')?.trim() || 'aluno-first-crm';
}

async function evolutionFetch(path: string, init?: RequestInit) {
  const baseUrl = requireEnv('EVOLUTION_API_URL').replace(/\/$/, '');
  assertReachableEvolutionUrl(baseUrl);
  const apiKey = requireEnv('EVOLUTION_API_KEY');

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && payload !== null
        ? String((payload as Record<string, unknown>).message ?? (payload as Record<string, unknown>).error ?? text.slice(0, 200))
        : text.slice(0, 200);
    throw new Error(`Evolution API (${response.status}): ${message}`);
  }

  return payload;
}

function normalizeInstanceRow(item: Record<string, unknown>) {
  const instance = item.instance ?? item;
  const record = (instance && typeof instance === 'object' ? instance : item) as Record<string, unknown>;
  return {
    instanceName: String(record.instanceName ?? record.name ?? ''),
    state: String(record.state ?? record.connectionStatus ?? record.status ?? 'close'),
    owner: record.owner != null ? String(record.owner) : null,
    profileName: record.profileName != null ? String(record.profileName) : null,
  };
}

async function fetchInstanceStatus(instanceName: string) {
  const payload = await evolutionFetch('/instance/fetchInstances');
  const list = Array.isArray(payload) ? payload : [];
  const match = list
    .map((item) => normalizeInstanceRow(item as Record<string, unknown>))
    .find((row) => row.instanceName === instanceName);

  if (!match) {
    return {
      instanceName,
      exists: false,
      state: 'close',
      owner: null,
      profileName: null,
    };
  }

  return {
    instanceName,
    exists: true,
    state: match.state,
    owner: match.owner,
    profileName: match.profileName,
  };
}

async function connectInstance(instanceName: string) {
  const status = await fetchInstanceStatus(instanceName);

  if (!status.exists) {
    await evolutionFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });
  }

  const payload = await evolutionFetch(`/instance/connect/${encodeURIComponent(instanceName)}`);
  const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;

  const base64 = typeof data.base64 === 'string' ? data.base64 : null;
  const pairingCode = typeof data.pairingCode === 'string' ? data.pairingCode : null;
  const state = typeof data.state === 'string' ? data.state : status.state;
  const connected = state === 'open' || (!base64 && status.state === 'open');

  return {
    instanceName,
    connected,
    state: connected ? 'open' : state,
    base64,
    pairingCode,
  };
}

async function setupWebhook(instanceName: string) {
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const webhookUrl = Deno.env.get('EVOLUTION_WEBHOOK_URL')?.trim() ||
    `${supabaseUrl}/functions/v1/evolution-webhook`;
  await evolutionFetch(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        webhook_by_events: false,
        events: ['MESSAGES_UPSERT'],
        enabled: true,
        ...(anonKey
          ? {
            headers: {
              Authorization: `Bearer ${anonKey}`,
              apikey: anonKey,
            },
          }
          : {}),
      },
    }),
  });
  return { ok: true, webhookUrl };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const action: Action =
      body.action === 'connect' || body.action === 'create' || body.action === 'logout' ||
        body.action === 'setupWebhook'
        ? body.action
        : 'status';
    const instanceName = defaultInstanceName(body.instanceName);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Não autorizado' }, 401);

    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('profile')
      .eq('id', user.id)
      .single();
    if (profile?.profile !== 'admin') return jsonResponse({ error: 'Acesso restrito a administradores' }, 403);

    if (action === 'create') {
      await evolutionFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        }),
      });
      const status = await fetchInstanceStatus(instanceName);
      return jsonResponse({ ok: true, ...status });
    }

    if (action === 'logout') {
      await evolutionFetch(`/instance/logout/${encodeURIComponent(instanceName)}`, {
        method: 'DELETE',
      });
      const status = await fetchInstanceStatus(instanceName);
      return jsonResponse({ ok: true, ...status });
    }

    if (action === 'connect') {
      const result = await connectInstance(instanceName);
      if (result.connected) await setupWebhook(instanceName).catch(() => undefined);
      return jsonResponse(result);
    }

    if (action === 'setupWebhook') {
      const result = await setupWebhook(instanceName);
      return jsonResponse(result);
    }

    const status = await fetchInstanceStatus(instanceName);
    return jsonResponse(status);
  } catch (error) {
    console.error('evolution-whatsapp error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao consultar Evolution API';
    return jsonResponse({ error: message }, 500);
  }
});
