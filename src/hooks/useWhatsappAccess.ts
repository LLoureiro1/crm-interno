import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type WhatsappAccessState = {
  loading: boolean;
  canView: boolean;
  instanceName: string | null;
};

export function useWhatsappAccess(): WhatsappAccessState {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [instanceName, setInstanceName] = useState<string | null>(null);

  const isAdmin = profile?.profile === 'admin';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user || !isAdmin) {
        if (!cancelled) {
          setInstanceName(null);
          setLoading(false);
        }
        return;
      }

      const { data: integration } = await supabase
        .from('whatsapp_integrations')
        .select('instance_name')
        .eq('is_active', true)
        .maybeSingle();

      if (!cancelled) {
        setInstanceName(integration?.instance_name ?? 'aluno-first-crm');
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
  };
}
