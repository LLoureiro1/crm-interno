import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, UserCheck, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  assignmentsByPhone,
  formatWhatsappPhone,
  groupMessagesByPhone,
  type WhatsappConversationAssignment,
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
  const { profile } = useAuth();
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [assignments, setAssignments] = useState<WhatsappConversationAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assumingPhone, setAssumingPhone] = useState<string | null>(null);

  const loadData = useCallback(async (name: string) => {
    const [messagesRes, assignmentsRes] = await Promise.all([
      supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('instance_name', name)
        .order('received_at', { ascending: false })
        .limit(200),
      supabase
        .from('whatsapp_conversation_assignments')
        .select('*')
        .eq('instance_name', name),
    ]);

    if (!messagesRes.error && messagesRes.data) setMessages(messagesRes.data);
    if (!assignmentsRes.error && assignmentsRes.data) setAssignments(assignmentsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!instanceName) return;
    setLoading(true);
    void loadData(instanceName);
    const id = window.setInterval(() => void loadData(instanceName), MESSAGES_POLL_MS);
    return () => window.clearInterval(id);
  }, [instanceName, loadData]);

  const conversations = useMemo(() => groupMessagesByPhone(messages), [messages]);
  const assignmentMap = useMemo(() => assignmentsByPhone(assignments), [assignments]);

  const handleAssumeConversation = async (
    e: React.MouseEvent,
    senderPhone: string,
  ) => {
    e.stopPropagation();

    if (!profile?.id || !profile.name) {
      toast.error('Faça login para assumir uma conversa.');
      return;
    }

    setAssumingPhone(senderPhone);

    const payload = {
      instance_name: instanceName,
      sender_phone: senderPhone,
      assigned_user_id: profile.id,
      assigned_user_name: profile.name,
      assigned_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('whatsapp_conversation_assignments')
      .upsert(payload, { onConflict: 'instance_name,sender_phone' })
      .select()
      .single();

    setAssumingPhone(null);

    if (error) {
      toast.error('Não foi possível assumir a conversa.');
      return;
    }

    if (data) {
      setAssignments((prev) => {
        const next = prev.filter((a) => a.sender_phone !== senderPhone);
        return [...next, data];
      });
    }

    toast.success('Conversa assumida com sucesso.');
  };

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
            const assignment = assignmentMap.get(conversation.senderPhone);
            const isAssignedToMe = assignment?.assigned_user_id === profile?.id;
            const isAssuming = assumingPhone === conversation.senderPhone;

            return (
              <AccordionItem key={conversation.senderPhone} value={conversation.senderPhone} className="overflow-hidden">
                <AccordionTrigger className="items-start gap-2 px-2 py-3 hover:no-underline [&>svg:last-child]:hidden [&[data-state=open]_.accordion-chevron]:rotate-180">
                  <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-sm font-semibold text-[#128C7E]">
                      {(conversation.senderName ?? displayPhone).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        <span className="truncate font-medium">
                          {conversation.senderName ?? displayPhone}
                        </span>
                        {conversation.senderName && (
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                            {displayPhone}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {conversation.senderName && (
                          <span className="truncate text-xs text-muted-foreground sm:hidden">
                            {displayPhone}
                          </span>
                        )}
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {conversation.messages.length}
                        </Badge>
                        {assignment && (
                          <Badge
                            variant="outline"
                            className={`shrink-0 gap-1 text-xs ${
                              isAssignedToMe
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-amber-200 bg-amber-50 text-amber-900'
                            }`}
                          >
                            <UserCheck className="h-3 w-3" />
                            <span className="max-w-[8rem] truncate">
                              {isAssignedToMe ? 'Você' : assignment.assigned_user_name}
                            </span>
                          </Badge>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(latest.received_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {latest.from_me ? 'Você: ' : ''}
                        {latest.message_text}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-start">
                    {!isAssignedToMe && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isAssuming}
                        className="h-8 shrink-0 gap-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 text-xs font-semibold text-[#128C7E] shadow-none hover:bg-[#25D366]/20 hover:text-[#0e6b5c] focus-visible:ring-[#25D366]/40"
                        onClick={(e) => void handleAssumeConversation(e, conversation.senderPhone)}
                      >
                        {isAssuming ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            Assumir Conversa
                          </>
                        )}
                      </Button>
                    )}
                    <ChevronDown className="accordion-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
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
                          className={`max-w-[80%] break-words rounded-lg px-3 py-2 text-sm shadow-sm ${
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
