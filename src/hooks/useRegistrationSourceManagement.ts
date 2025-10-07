import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Interfaces para a nova estrutura
interface GlobalRegistrationSource {
  id: string;
  source_key: string;
  source_label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UnitRegistrationSourceAssociation {
  id: string;
  unit_id: string;
  global_source_id: string;
  is_active: boolean;
  sort_order: number;
  custom_label?: string;
  created_at: string;
  updated_at: string;
  global_registration_sources?: GlobalRegistrationSource;
}

interface UseRegistrationSourceManagementProps {
  unitId: string;
}

export const useRegistrationSourceManagement = ({ unitId }: UseRegistrationSourceManagementProps) => {
  const [sources, setSources] = useState<UnitRegistrationSourceAssociation[]>([]);
  const [globalSources, setGlobalSources] = useState<GlobalRegistrationSource[]>([]);
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
      // Buscar associações da unidade com dados das origens globais
      const { data, error } = await (supabase as any)
        .from('unit_registration_source_associations')
        .select(`
          *,
          global_registration_sources!inner (
            id,
            source_key,
            source_label,
            is_active
          )
        `)
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

  const fetchGlobalSources = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('global_registration_sources')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setGlobalSources(data || []);
    } catch (err) {
      console.error('Erro ao buscar origens globais:', err);
      toast.error('Erro ao carregar origens globais');
    }
  };

  const createAssociation = async (globalSourceId: string, customLabel?: string) => {
    try {
      // Encontrar o próximo sort_order
      const maxOrder = sources.length > 0 ? Math.max(...sources.map(s => s.sort_order)) : 0;
      
      const { data, error } = await (supabase as any)
        .from('unit_registration_source_associations')
        .insert({
          unit_id: unitId,
          global_source_id: globalSourceId,
          custom_label: customLabel,
          is_active: true,
          sort_order: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Origem associada com sucesso!');
      await fetchSources();
      return data;
    } catch (err) {
      console.error('Erro ao associar origem:', err);
      toast.error('Erro ao associar origem');
      throw err;
    }
  };

  const updateAssociation = async (id: string, updates: Partial<UnitRegistrationSourceAssociation>) => {
    try {
      const { data, error } = await (supabase as any)
        .from('unit_registration_source_associations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Associação atualizada com sucesso!');
      await fetchSources();
      return data;
    } catch (err) {
      console.error('Erro ao atualizar associação:', err);
      toast.error('Erro ao atualizar associação');
      throw err;
    }
  };

  const deleteAssociation = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('unit_registration_source_associations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Associação removida com sucesso!');
      await fetchSources();
    } catch (err) {
      console.error('Erro ao remover associação:', err);
      toast.error('Erro ao remover associação');
      throw err;
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    return updateAssociation(id, { is_active: isActive });
  };

  const reorderSources = async (sourceId: string, newOrder: number) => {
    try {
      const { error } = await (supabase as any)
        .from('unit_registration_source_associations')
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
        throw new Error('Associação não encontrada');
      }

      // Trocar as posições
      await (supabase as any)
        .from('unit_registration_source_associations')
        .update({ sort_order: source2.sort_order })
        .eq('id', source1Id);

      await (supabase as any)
        .from('unit_registration_source_associations')
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
    fetchGlobalSources();
  }, [unitId]);

  return {
    sources,
    globalSources,
    loading,
    error,
    fetchSources,
    fetchGlobalSources,
    createAssociation,
    updateAssociation,
    deleteAssociation,
    toggleActive,
    reorderSources,
    swapOrder
  };
};
