/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isMessagesUpsertEvent(event: unknown): boolean {
  return String(event ?? '').toLowerCase().replace(/_/g, '.') === 'messages.upsert';
}

function extractMessageText(message: Record<string, unknown>): string | null {
  if (typeof message.conversation === 'string') return message.conversation;
  const extended = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (extended && typeof extended.text === 'string') return extended.text;
  const image = message.imageMessage as Record<string, unknown> | undefined;
  if (image && typeof image.caption === 'string') return image.caption;
  return null;
}

function normalizeSenderPhone(jid: string): string {
  return jid.split('@')[0]?.replace(/\D/g, '') || jid;
}

function parseMessageReceivedAt(data: Record<string, unknown>): string {
  const ts = data.messageTimestamp;
  if (typeof ts === 'number') return new Date(ts * 1000).toISOString();
  if (typeof ts === 'string' && /^\d+$/.test(ts)) return new Date(Number(ts) * 1000).toISOString();
  return new Date().toISOString();
}

function buildExternalId(
  key: Record<string, unknown>,
  senderPhone: string,
  receivedAt: string,
  text: string,
): string {
  if (key.id != null) return String(key.id);
  return `${senderPhone}-${receivedAt}-${text.slice(0, 32)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    if (!isMessagesUpsertEvent(body.event)) return jsonResponse({ status: 'ignored', reason: 'event' });

    const data = (body.data ?? {}) as Record<string, unknown>;
    const key = (data.key ?? {}) as Record<string, unknown>;
    if (key.fromMe === true) return jsonResponse({ status: 'ignored', reason: 'fromMe' });

    const message = (data.message ?? {}) as Record<string, unknown>;
    const text = extractMessageText(message);
    if (!text) return jsonResponse({ status: 'no_text' });

    const instanceName = String(body.instance ?? Deno.env.get('EVOLUTION_INSTANCE') ?? 'aluno-first-crm');
    const senderPhone = normalizeSenderPhone(String(key.remoteJid ?? ''));
    const senderName = typeof data.pushName === 'string' ? data.pushName : null;
    const receivedAt = parseMessageReceivedAt(data);
    const externalId = buildExternalId(key, senderPhone, receivedAt, text);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error } = await supabase.from('whatsapp_messages').upsert(
      {
        instance_name: instanceName,
        sender_phone: senderPhone,
        sender_name: senderName,
        message_text: text,
        received_at: receivedAt,
        external_id: externalId,
      },
      { onConflict: 'instance_name,external_id', ignoreDuplicates: true },
    );

    if (error) throw error;
    return jsonResponse({ status: 'ok' });
  } catch (error) {
    console.error('evolution-webhook error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao gravar mensagem';
    return jsonResponse({ error: message }, 500);
  }
});
