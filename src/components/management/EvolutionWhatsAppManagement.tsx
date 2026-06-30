import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invokeEvolutionWhatsApp, type EvolutionWhatsAppResponse } from '@/lib/evolutionWhatsApp';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCw,
} from 'lucide-react';

type EvolutionResponse = EvolutionWhatsAppResponse;

type WhatsappMessage = Tables<'whatsapp_messages'>;

type ConversationGroup = {
  senderPhone: string;
  senderName: string | null;
  messages: WhatsappMessage[];
  latestMessage: WhatsappMessage;
};

const QR_REFRESH_SECONDS = 55;
const POLL_CONNECTED_MS = 5000;
const MESSAGES_POLL_MS = 8000;

async function invokeEvolution(body: Record<string, unknown>): Promise<EvolutionResponse> {
  return invokeEvolutionWhatsApp(body);
}

function formatPhone(owner: string | null | undefined): string | null {
  if (!owner) return null;
  const digits = owner.replace(/\D/g, '');
  if (digits.length < 10) return owner;
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  return `+${digits}`;
}

function groupMessagesByPhone(messages: WhatsappMessage[]): ConversationGroup[] {
  const map = new Map<string, WhatsappMessage[]>();
  for (const msg of messages) {
    const list = map.get(msg.sender_phone) ?? [];
    list.push(msg);
    map.set(msg.sender_phone, list);
  }

  return [...map.entries()]
    .map(([senderPhone, msgs]) => {
      const sorted = [...msgs].sort(
        (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
      );
      return {
        senderPhone,
        senderName:
          sorted.find((m) => m.sender_name && !m.from_me)?.sender_name ??
          sorted.find((m) => m.sender_name)?.sender_name ??
          null,
        messages: [...sorted].reverse(),
        latestMessage: sorted[0],
      };
    })
    .sort(
      (a, b) =>
        new Date(b.latestMessage.received_at).getTime() - new Date(a.latestMessage.received_at).getTime(),
    );
}

function stateBadge(state: string | undefined, connected?: boolean) {
  if (connected || state === 'open') {
    return (
      <Badge className="bg-[#25D366] hover:bg-[#25D366]">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        Conectado
      </Badge>
    );
  }
  if (state === 'connecting') {
    return (
      <Badge variant="secondary">
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        Conectando
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <AlertCircle className="mr-1 h-3.5 w-3.5" />
      Desconectado
    </Badge>
  );
}

export function EvolutionWhatsAppManagement() {
  const [instanceName, setInstanceName] = useState('aluno-first-crm');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<EvolutionResponse | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(QR_REFRESH_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const pollRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (countdownRef.current != null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const loadStatus = useCallback(async (name: string) => {
    const data = await invokeEvolution({ action: 'status', instanceName: name });
    setStatus(data);
    if (data.connected || data.state === 'open') {
      void invokeEvolution({ action: 'setupWebhook', instanceName: name }).catch(() => undefined);
    }
    return data;
  }, []);

  const loadMessages = useCallback(async (name: string) => {
    const { data, error: fetchError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('instance_name', name)
      .order('received_at', { ascending: false })
      .limit(200);
    if (!fetchError && data) setMessages(data);
  }, []);

  const refreshQr = useCallback(
    async (name: string, silent = false) => {
      setConnecting(true);
      setError(null);
      try {
        const data = await invokeEvolution({ action: 'connect', instanceName: name });
        setStatus(data);

        if (data.connected || data.state === 'open') {
          setQrBase64(null);
          clearTimers();
          if (!silent) toast.success('WhatsApp conectado com sucesso!');
          return data;
        }

        setQrBase64(data.base64 ?? null);
        setCountdown(QR_REFRESH_SECONDS);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao obter QR Code';
        setError(message);
        if (!silent) toast.error(message);
        throw err;
      } finally {
        setConnecting(false);
      }
    },
    [clearTimers],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadStatus(instanceName);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar status');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instanceName, loadStatus]);

  useEffect(() => {
    clearTimers();

    const isConnected = status?.connected || status?.state === 'open';
    if (isConnected || !qrBase64) return;

    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return QR_REFRESH_SECONDS;
        return prev - 1;
      });
    }, 1000);

    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const current = await loadStatus(instanceName);
          if (current.state === 'open') {
            setQrBase64(null);
            clearTimers();
            toast.success('WhatsApp conectado!');
            return;
          }
          await refreshQr(instanceName, true);
        } catch {
          /* polling silencioso */
        }
      })();
    }, POLL_CONNECTED_MS);

    return clearTimers;
  }, [clearTimers, instanceName, loadStatus, qrBase64, refreshQr, status?.connected, status?.state]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    const connected = status?.connected || status?.state === 'open';
    if (!connected) return;
    void loadMessages(instanceName);
    const id = window.setInterval(() => void loadMessages(instanceName), MESSAGES_POLL_MS);
    return () => window.clearInterval(id);
  }, [instanceName, loadMessages, status?.connected, status?.state]);

  const handleConnect = async () => {
    try {
      await refreshQr(instanceName);
    } catch {
      /* erro já tratado */
    }
  };

  const handleRefreshStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadStatus(instanceName);
      toast.success('Status atualizado');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao atualizar status';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const data = await invokeEvolution({ action: 'logout', instanceName });
      setStatus(data);
      setQrBase64(null);
      clearTimers();
      toast.success('WhatsApp desconectado');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao desconectar';
      setError(message);
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  };

  const isConnected = Boolean(status?.connected || status?.state === 'open');
  const phone = formatPhone(status?.owner);
  const conversations = useMemo(() => groupMessagesByPhone(messages), [messages]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="evolution-instance">Nome da instância Evolution</Label>
          <Input
            id="evolution-instance"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value.trim())}
            placeholder="aluno-first-crm"
            disabled={connecting || isConnected}
          />
          <p className="text-xs text-muted-foreground">
            Deve corresponder à instância criada na Evolution API (Docker).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void handleRefreshStatus()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar status
          </Button>
          {isConnected ? (
            <Button type="button" variant="destructive" onClick={() => void handleDisconnect()} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              Desconectar
            </Button>
          ) : (
            <Button type="button" onClick={() => void handleConnect()} disabled={connecting || !instanceName}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Gerar QR Code
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
            <span className="font-medium">Status da conexão</span>
          </div>
          {stateBadge(status?.state, isConnected)}
        </div>

        {loading && !status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando Evolution API...
          </div>
        ) : (
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Instância</dt>
              <dd className="font-medium">{status?.instanceName ?? instanceName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cadastrada na API</dt>
              <dd className="font-medium">{status?.exists ? 'Sim' : 'Não — será criada ao gerar QR'}</dd>
            </div>
            {status?.profileName && (
              <div>
                <dt className="text-muted-foreground">Perfil WhatsApp</dt>
                <dd className="font-medium">{status.profileName}</dd>
              </div>
            )}
            {phone && (
              <div>
                <dt className="text-muted-foreground">Número</dt>
                <dd className="font-medium">{phone}</dd>
              </div>
            )}
          </dl>
        )}

        {isConnected ? (
          <div className="mt-6 rounded-lg border border-[#25D366]/30 bg-white p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[#25D366]" />
            <p className="text-lg font-semibold text-[#128C7E]">WhatsApp conectado!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A instância está pronta para enviar e receber mensagens via Evolution API.
            </p>
          </div>
        ) : qrBase64 ? (
          <div className="mt-6 flex flex-col items-center text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              WhatsApp → Dispositivos conectados → Conectar dispositivo
            </p>
            <img
              src={qrBase64}
              alt="QR Code WhatsApp"
              className="w-[280px] rounded-xl border-4 border-[#25D366] bg-white p-3"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Novo QR Code em <span className="font-semibold text-foreground">{countdown}s</span>
            </p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void handleConnect()} disabled={connecting}>
              Gerar novo QR Code
            </Button>
          </div>
        ) : (
          !loading && (
            <p className="mt-4 text-sm text-muted-foreground">
              Clique em &quot;Gerar QR Code&quot; para conectar o WhatsApp ao CRM.
            </p>
          )
        )}
      </div>

      {isConnected && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-medium">Conversas</h3>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {conversations.map((conversation) => {
                const displayPhone = formatPhone(conversation.senderPhone) ?? conversation.senderPhone;
                const latest = conversation.latestMessage;
                return (
                  <AccordionItem key={conversation.senderPhone} value={conversation.senderPhone}>
                    <AccordionTrigger className="px-2 hover:no-underline">
                      <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-sm font-semibold text-[#128C7E]">
                          {(conversation.senderName ?? displayPhone).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {conversation.senderName ?? displayPhone}
                            </span>
                            {conversation.senderName && (
                              <span className="text-xs text-muted-foreground">{displayPhone}</span>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {conversation.messages.length}
                            </Badge>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {latest.from_me ? 'Você: ' : ''}
                            {latest.message_text}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(latest.received_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2">
                      <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg bg-[#efeae2] p-3">
                        {conversation.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex flex-col gap-0.5 ${msg.from_me ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                                msg.from_me
                                  ? 'rounded-tr-none bg-[#d9fdd3] text-gray-900'
                                  : 'rounded-tl-none bg-white text-gray-900'
                              }`}
                            >
                              {msg.message_text}
                            </div>
                            <span className="px-1 text-[10px] text-muted-foreground">
                              {new Date(msg.received_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Em desenvolvimento (<code className="text-xs">npm run dev</code>), o CRM usa um proxy local que lê{' '}
          <code className="text-xs">EVOLUTION_API_URL</code> e <code className="text-xs">EVOLUTION_API_KEY</code> do
          arquivo <code className="text-xs">.env</code> na raiz do projeto (use{' '}
          <code className="text-xs">http://127.0.0.1:8081</code>). Em produção, configure os secrets na Edge Function{' '}
          <code className="text-xs">evolution-whatsapp</code> com uma URL pública (ex.: ngrok ou servidor VPS).
        </AlertDescription>
      </Alert>
    </div>
  );
}
