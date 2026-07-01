import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { invokeEvolutionWhatsApp } from '@/lib/evolutionWhatsApp';

type WhatsappAccessState = {
  loading: boolean;
  canView: boolean;
  instanceName: string | null;
  isConnected: boolean;
};

export function useWhatsappAccess(): WhatsappAccessState {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const isAdmin = profile?.profile === 'admin';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user || !isAdmin) {
        if (!cancelled) {
          setInstanceName(null);
          setIsConnected(false);
          setLoading(false);
        }
        return;
      }

      const { data: integration } = await supabase
        .from('whatsapp_integrations')
        .select('instance_name, display_phone')
        .eq('is_active', true)
        .maybeSingle();

      const name = integration?.instance_name ?? 'aluno-first-crm';

      let connected = false;
      try {
        const status = await invokeEvolutionWhatsApp({ action: 'status', instanceName: name });
        connected = Boolean(status.connected || status.state === 'open');
      } catch {
        connected = Boolean(integration?.display_phone);
      }

      if (!cancelled) {
        setInstanceName(name);
        setIsConnected(connected);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  return {
    loading,
    canView: isAdmin,
    instanceName: isAdmin ? instanceName : null,
    isConnected: isAdmin && isConnected,
  };
}
