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
        // Usar a nova estrutura: JOIN entre associações e origens globais
        const { data, error } = await (supabase as any)
          .from('unit_registration_source_associations')
          .select(`
            id,
            sort_order,
            custom_label,
            global_registration_sources!inner (
              id,
              source_key,
              source_label
            )
          `)
          .eq('unit_id', unitId)
          .eq('is_active', true)
          .eq('global_registration_sources.is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        // Transformar dados para o formato esperado
        const transformedSources: RegistrationSource[] = (data || []).map((item: any) => ({
          id: item.id,
          source_key: item.global_registration_sources.source_key,
          source_label: item.custom_label || item.global_registration_sources.source_label,
          sort_order: item.sort_order
        }));

        setSources(transformedSources);
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
