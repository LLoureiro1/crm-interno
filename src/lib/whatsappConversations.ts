import type { Tables } from '@/integrations/supabase/types';

export type WhatsappMessage = Tables<'whatsapp_messages'>;
export type WhatsappConversationAssignment = Tables<'whatsapp_conversation_assignments'>;

export type ConversationGroup = {
  senderPhone: string;
  senderName: string | null;
  messages: WhatsappMessage[];
  latestMessage: WhatsappMessage;
};

export function formatWhatsappPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return value;
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  return `+${digits}`;
}

export function groupMessagesByPhone(messages: WhatsappMessage[]): ConversationGroup[] {
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

export function assignmentsByPhone(
  assignments: WhatsappConversationAssignment[],
): Map<string, WhatsappConversationAssignment> {
  return new Map(assignments.map((a) => [a.sender_phone, a]));
}
