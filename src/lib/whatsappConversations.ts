import type { Tables } from '@/integrations/supabase/types';

export type WhatsappMessage = Tables<'whatsapp_messages'>;
export type WhatsappConversationAssignment = Tables<'whatsapp_conversation_assignments'>;
export type WhatsappConversationLabel = Tables<'whatsapp_conversation_labels'>;

export type LeadLabelKind = 'inscrito' | 'propensao' | null;

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

/** Apenas dígitos — ignora espaços, parênteses, hífens e + */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Gera chaves comparáveis para cruzar WhatsApp ↔ telefones do CRM.
 * Trata +55 com ou sem código do país e variações de máscara.
 */
export function phoneComparisonKeys(value: string): string[] {
  const digits = normalizePhoneDigits(value);
  if (!digits) return [];

  const keys = new Set<string>([digits]);

  const withoutCountry = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : null;
  if (withoutCountry) {
    keys.add(withoutCountry);
  }

  if (digits.length === 10 || digits.length === 11) {
    keys.add(`55${digits}`);
  }

  const local = withoutCountry ?? (digits.length <= 11 ? digits : digits.slice(-11));
  if (local.length >= 10) {
    keys.add(local);
    keys.add(local.slice(-11));
    if (local.length >= 10) keys.add(local.slice(-10));
  }

  if (digits.length > 11) {
    keys.add(digits.slice(-11));
    keys.add(digits.slice(-10));
  }

  return [...keys].filter((k) => k.length >= 8);
}

export function phonesMatch(a: string, b: string): boolean {
  const keysB = new Set(phoneComparisonKeys(b));
  return phoneComparisonKeys(a).some((key) => keysB.has(key));
}

export type StudentPhoneLink = {
  id: string;
  student_name: string;
};

type StudentPhoneRow = {
  id: string;
  student_name: string;
  phone: string | null;
  student_phones?: { phone_number: string }[] | null;
};

export function buildStudentPhoneIndex(students: StudentPhoneRow[]): Map<string, StudentPhoneLink> {
  const index = new Map<string, StudentPhoneLink>();
  for (const student of students) {
    const link = { id: student.id, student_name: student.student_name };
    const numbers = [
      student.phone,
      ...(student.student_phones?.map((p) => p.phone_number) ?? []),
    ].filter((p): p is string => Boolean(p?.trim()));

    for (const number of numbers) {
      for (const key of phoneComparisonKeys(number)) {
        index.set(key, link);
      }
    }
  }
  return index;
}

export function findStudentByPhone(
  senderPhone: string,
  index: Map<string, StudentPhoneLink>,
): StudentPhoneLink | null {
  for (const key of phoneComparisonKeys(senderPhone)) {
    const match = index.get(key);
    if (match) return match;
  }
  return null;
}

export function conversationMatchesSearch(
  conversation: ConversationGroup,
  searchTerm: string,
): boolean {
  const term = searchTerm.trim();
  if (!term) return true;

  const lower = term.toLowerCase();
  const termDigits = normalizePhoneDigits(term);

  if (conversation.senderName?.toLowerCase().includes(lower)) return true;

  if (termDigits.length >= 3) {
    const senderKeys = phoneComparisonKeys(conversation.senderPhone);
    if (senderKeys.some((k) => k.includes(termDigits))) return true;
    if (phonesMatch(conversation.senderPhone, term)) return true;
  }

  return conversation.messages.some((m) => m.message_text.toLowerCase().includes(lower));
}

export function filterConversationsBySearch(
  conversations: ConversationGroup[],
  searchTerm: string,
): ConversationGroup[] {
  if (!searchTerm.trim()) return conversations;
  return conversations.filter((c) => conversationMatchesSearch(c, searchTerm));
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

export function labelsByPhone(
  labels: WhatsappConversationLabel[],
): Map<string, WhatsappConversationLabel> {
  return new Map(labels.map((l) => [l.sender_phone, l]));
}

export function resolveLeadLabelKind(
  linkedStudent: StudentPhoneLink | null,
  label: WhatsappConversationLabel | undefined,
): LeadLabelKind {
  if (linkedStudent) return 'inscrito';
  if (label?.label_type === 'propensao' && label.propensity_stars) return 'propensao';
  return null;
}
