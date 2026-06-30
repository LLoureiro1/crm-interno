import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type Action = 'status' | 'connect' | 'create' | 'logout';

type RequestBody = {
  action?: Action;
  instanceName?: string;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function requireEnv(env: Record<string, string>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Variável ${name} não configurada no .env`);
  return value;
}

function defaultInstanceName(env: Record<string, string>, override?: string): string {
  return override?.trim() || env.EVOLUTION_INSTANCE?.trim() || 'aluno-first-crm';
}

async function evolutionFetch(env: Record<string, string>, path: string, init?: RequestInit) {
  const baseUrl = requireEnv(env, 'EVOLUTION_API_URL').replace(/\/$/, '');
  const apiKey = requireEnv(env, 'EVOLUTION_API_KEY');

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
        ? String(
            (payload as Record<string, unknown>).message ??
              (payload as Record<string, unknown>).error ??
              text.slice(0, 200),
          )
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

async function fetchInstanceStatus(env: Record<string, string>, instanceName: string) {
  const payload = await evolutionFetch(env, '/instance/fetchInstances');
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

async function connectInstance(env: Record<string, string>, instanceName: string) {
  const status = await fetchInstanceStatus(env, instanceName);

  if (!status.exists) {
    await evolutionFetch(env, '/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });
  }

  const payload = await evolutionFetch(env, `/instance/connect/${encodeURIComponent(instanceName)}`);
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

async function handleRequest(env: Record<string, string>, body: RequestBody) {
  const action: Action =
    body.action === 'connect' || body.action === 'create' || body.action === 'logout'
      ? body.action
      : 'status';
  const instanceName = defaultInstanceName(env, body.instanceName);

  if (action === 'create') {
    await evolutionFetch(env, '/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });
    const status = await fetchInstanceStatus(env, instanceName);
    return { ok: true, ...status };
  }

  if (action === 'logout') {
    await evolutionFetch(env, `/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: 'DELETE',
    });
    const status = await fetchInstanceStatus(env, instanceName);
    return { ok: true, ...status };
  }

  if (action === 'connect') {
    return connectInstance(env, instanceName);
  }

  return fetchInstanceStatus(env, instanceName);
}

/** Proxy local para Evolution API — só em `npm run dev` (Supabase Cloud não alcança localhost). */
export function evolutionDevProxy(getEnv: () => Record<string, string>): Plugin {
  return {
    name: 'evolution-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/evolution-whatsapp' || req.method !== 'POST') {
          next();
          return;
        }

        try {
          const raw = await readBody(req);
          const body = (raw ? JSON.parse(raw) : {}) as RequestBody;
          const result = await handleRequest(getEnv(), body);
          sendJson(res, 200, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro ao consultar Evolution API';
          sendJson(res, 500, { error: message });
        }
      });
    },
  };
}
