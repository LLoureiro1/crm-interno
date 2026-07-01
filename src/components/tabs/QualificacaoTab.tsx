import { MessageCircle, Loader2 } from 'lucide-react';
import { WhatsappConversationsList } from '@/components/whatsapp/WhatsappConversationsList';
import { useWhatsappAccess } from '@/hooks/useWhatsappAccess';

export function QualificacaoTab() {
  const { loading, canView, instanceName } = useWhatsappAccess();

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  if (!canView || !instanceName) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Acesso restrito</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A aba Leads está disponível apenas para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageCircle className="h-5 w-5 text-[#128C7E]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">Leads</h2>
          <p className="text-sm text-muted-foreground">Conversas do WhatsApp conectado</p>
        </div>
      </div>
      <WhatsappConversationsList instanceName={instanceName} />
    </div>
  );
}
