import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type ConnectionState = 'open' | 'close' | 'connecting' | string;

export type EvolutionWhatsAppResponse = {
  instanceName?: string;
  exists?: boolean;
  connected?: boolean;
  state?: ConnectionState;
  base64?: string | null;
  pairingCode?: string | null;
  owner?: string | null;
  profileName?: string | null;
  error?: string;
};

const DEV_PROXY_URL = '/api/evolution-whatsapp';

async function invokeLocalProxy(body: Record<string, unknown>): Promise<EvolutionWhatsAppResponse> {
  const response = await fetch(DEV_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as EvolutionWhatsAppResponse;
  if (!response.ok || data.error) {
    throw new Error(data.error ?? 'Falha ao consultar Evolution API (proxy local)');
  }
  return data;
}

async function invokeEdgeFunction(body: Record<string, unknown>): Promise<EvolutionWhatsAppResponse> {
  const { data, error } = await supabase.functions.invoke('evolution-whatsapp', { body });

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
  return data as EvolutionWhatsAppResponse;
}

/** Em dev usa proxy do Vite → Docker local. Em produção usa Edge Function na nuvem. */
export async function invokeEvolutionWhatsApp(
  body: Record<string, unknown>,
): Promise<EvolutionWhatsAppResponse> {
  if (import.meta.env.DEV) {
    return invokeLocalProxy(body);
  }
  return invokeEdgeFunction(body);
}
