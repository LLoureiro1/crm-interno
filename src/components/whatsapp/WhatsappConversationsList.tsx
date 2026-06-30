import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2 } from 'lucide-react';
import {
  formatWhatsappPhone,
  groupMessagesByPhone,
  type WhatsappMessage,
} from '@/lib/whatsappConversations';

const MESSAGES_POLL_MS = 8000;

type WhatsappConversationsListProps = {
  instanceName: string;
  title?: string;
};

export function WhatsappConversationsList({
  instanceName,
  title = 'Conversas',
}: WhatsappConversationsListProps) {
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async (name: string) => {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('instance_name', name)
      .order('received_at', { ascending: false })
      .limit(200);

    if (!error && data) setMessages(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!instanceName) return;
    setLoading(true);
    void loadMessages(instanceName);
    const id = window.setInterval(() => void loadMessages(instanceName), MESSAGES_POLL_MS);
    return () => window.clearInterval(id);
  }, [instanceName, loadMessages]);

  const conversations = useMemo(() => groupMessagesByPhone(messages), [messages]);

  if (loading && conversations.length === 0) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando conversas...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 font-medium">{title}</h3>
      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
      ) : (
        <Accordion type="single" collapsible className="w-full">
          {conversations.map((conversation) => {
            const displayPhone = formatWhatsappPhone(conversation.senderPhone) ?? conversation.senderPhone;
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
                        <span className="font-medium">{conversation.senderName ?? displayPhone}</span>
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
  );
}
