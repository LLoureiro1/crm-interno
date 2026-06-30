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
  const [canView, setCanView] = useState(false);
  const [instanceName, setInstanceName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) {
        if (!cancelled) {
          setCanView(false);
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

      const activeInstance = integration?.instance_name ?? 'aluno-first-crm';

      if (profile?.profile === 'admin') {
        if (!cancelled) {
          setCanView(true);
          setInstanceName(activeInstance);
          setLoading(false);
        }
        return;
      }

      const { data: access } = await supabase
        .from('whatsapp_viewer_access')
        .select('instance_name')
        .eq('user_id', user.id)
        .eq('instance_name', activeInstance)
        .maybeSingle();

      if (!cancelled) {
        setCanView(Boolean(access));
        setInstanceName(access ? activeInstance : null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile?.profile]);

  return { loading, canView, instanceName };
}
