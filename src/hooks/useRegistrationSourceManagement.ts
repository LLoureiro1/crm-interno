import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type RegistrationSource = Tables<'unit_registration_sources'>;

interface UseRegistrationSourceManagementProps {
  unitId: string;
}

export const useRegistrationSourceManagement = ({ unitId }: UseRegistrationSourceManagementProps) => {
  const [sources, setSources] = useState<RegistrationSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = async () => {
    if (!unitId) {
      setSources([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('unit_registration_sources')
        .select('*')
        .eq('unit_id', unitId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setSources(data || []);
    } catch (err) {
      console.error('Erro ao buscar origens:', err);
      setError('Erro ao carregar origens');
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  const createSource = async (sourceData: Omit<RegistrationSource, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('unit_registration_sources')
        .insert(sourceData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Origem criada com sucesso!');
      await fetchSources();
      return data;
    } catch (err) {
      console.error('Erro ao criar origem:', err);
      toast.error('Erro ao criar origem');
      throw err;
    }
  };

  const updateSource = async (id: string, updates: Partial<RegistrationSource>) => {
    try {
      const { data, error } = await supabase
        .from('unit_registration_sources')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Origem atualizada com sucesso!');
      await fetchSources();
      return data;
    } catch (err) {
      console.error('Erro ao atualizar origem:', err);
      toast.error('Erro ao atualizar origem');
      throw err;
    }
  };

  const deleteSource = async (id: string) => {
    try {
      const { error } = await supabase
        .from('unit_registration_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Origem excluída com sucesso!');
      await fetchSources();
    } catch (err) {
      console.error('Erro ao excluir origem:', err);
      toast.error('Erro ao excluir origem');
      throw err;
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    return updateSource(id, { is_active: isActive });
  };

  const reorderSources = async (sourceId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('unit_registration_sources')
        .update({ sort_order: newOrder })
        .eq('id', sourceId);

      if (error) throw error;

      await fetchSources();
    } catch (err) {
      console.error('Erro ao reordenar:', err);
      toast.error('Erro ao reordenar');
      throw err;
    }
  };

  const swapOrder = async (source1Id: string, source2Id: string) => {
    try {
      const source1 = sources.find(s => s.id === source1Id);
      const source2 = sources.find(s => s.id === source2Id);

      if (!source1 || !source2) {
        throw new Error('Origem não encontrada');
      }

      // Trocar as posições
      await supabase
        .from('unit_registration_sources')
        .update({ sort_order: source2.sort_order })
        .eq('id', source1Id);

      await supabase
        .from('unit_registration_sources')
        .update({ sort_order: source1.sort_order })
        .eq('id', source2Id);

      toast.success('Ordem atualizada!');
      await fetchSources();
    } catch (err) {
      console.error('Erro ao trocar ordem:', err);
      toast.error('Erro ao trocar ordem');
      throw err;
    }
  };

  useEffect(() => {
    fetchSources();
  }, [unitId]);

  return {
    sources,
    loading,
    error,
    fetchSources,
    createSource,
    updateSource,
    deleteSource,
    toggleActive,
    reorderSources,
    swapOrder
  };
};
