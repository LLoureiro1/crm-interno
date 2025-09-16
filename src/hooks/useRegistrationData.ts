import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type City = Tables<'cities'>;
type Serie = Tables<'series'>;
type Class = Tables<'classes'> & {
  series: Serie;
  units: Tables<'units'>;
};

interface UseRegistrationDataReturn {
  series: Serie[];
  classes: Class[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useRegistrationData = (): UseRegistrationDataReturn => {
  const [series, setSeries] = useState<Serie[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🚀 Iniciando carregamento de dados...');
      
      // Teste de conectividade básica
      console.log('🔌 Testando conectividade com Supabase...');
      const { data: connectionTest, error: connectionError } = await supabase
        .from('series')
        .select('count')
        .limit(1);
      
      if (connectionError) {
        console.error('❌ Erro de conectividade:', connectionError);
        throw new Error(`Erro de conectividade: ${connectionError.message}`);
      }
      
      console.log('✅ Conectividade com Supabase OK');
      
      // Carregar séries
      console.log('📚 Carregando séries...');
      const { data: seriesData, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .order('name');

      console.log('📚 Dados de séries recebidos:', { 
        count: seriesData?.length || 0, 
        data: seriesData, 
        error: seriesError 
      });

      if (seriesError) {
        console.error('❌ Erro ao carregar séries:', seriesError);
        throw new Error(`Erro ao carregar séries: ${seriesError.message}`);
      }
      
      if (!seriesData || seriesData.length === 0) {
        console.warn('⚠️ Nenhuma série encontrada no banco de dados');
        toast.warning('Nenhuma série encontrada. Verifique se os dados iniciais foram inseridos.');
      }
      
      setSeries(seriesData || []);
      console.log('✅ Séries definidas no estado:', seriesData?.length || 0, 'séries');

      // Carregar turmas com relacionamentos
      console.log('📊 Carregando turmas...');
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          series (*),
          units (*)
        `)
        .order('name');

      console.log('📊 Dados de turmas recebidos:', { 
        count: classesData?.length || 0, 
        data: classesData, 
        error: classesError 
      });

      if (classesError) {
        console.error('❌ Erro ao carregar turmas:', classesError);
        throw new Error(`Erro ao carregar turmas: ${classesError.message}`);
      }
      
      setClasses(classesData || []);
      console.log('✅ Turmas definidas no estado:', classesData?.length || 0, 'turmas');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro ao carregar dados iniciais:', error);
      setError(errorMessage);
      toast.error(`Erro ao carregar dados do formulário: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await loadInitialData();
  };

  useEffect(() => {
    console.log('🔧 Hook useRegistrationData inicializado');
    loadInitialData();
  }, []);

  console.log('📋 Estado atual do hook:', { 
    series: series.length, 
    classes: classes.length, 
    loading, 
    error 
  });

  return { 
    series, 
    classes, 
    loading, 
    error, 
    refetch 
  };
};