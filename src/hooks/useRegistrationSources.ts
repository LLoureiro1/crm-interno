import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RegistrationSource } from '@/types/registration';

export const useRegistrationSources = (unitId: string) => {
  const [sources, setSources] = useState<RegistrationSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) {
      setSources([]);
      return;
    }

    const fetchSources = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('unit_registration_sources')
          .select('id, source_key, source_label, sort_order')
          .eq('unit_id', unitId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        setSources(data || []);
      } catch (err) {
        console.error('Erro ao buscar origens de inscrição:', err);
        setError('Erro ao carregar opções de origem');
        setSources([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSources();
  }, [unitId]);

  const hasSources = sources.length > 0;

  return { sources, loading, error, hasSources };
};
