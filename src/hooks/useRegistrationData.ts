
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

export const useRegistrationData = () => {
  const [series, setSeries] = useState<Serie[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const loadInitialData = async () => {
    try {
      console.log('🚀 Iniciando carregamento de dados...');
      
      // Carregar séries
      const { data: seriesData, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .order('name');

      console.log('📚 Dados de séries recebidos:', { seriesData, seriesError });

      if (seriesError) throw seriesError;
      setSeries(seriesData || []);
      console.log('✅ Séries definidas no estado:', seriesData || []);

      // Carregar turmas com relacionamentos
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          series (*),
          units (*)
        `)
        .order('name');

      console.log('📊 Dados de turmas recebidos:', { classesData, classesError });

      if (classesError) throw classesError;
      setClasses(classesData || []);
      console.log('✅ Turmas definidas no estado:', classesData || []);

    } catch (error) {
      console.error('❌ Erro ao carregar dados iniciais:', error);
      toast.error('Erro ao carregar dados do formulário');
    }
  };

  useEffect(() => {
    console.log('🔧 Hook useRegistrationData inicializado');
    loadInitialData();
  }, []);

  console.log('📋 Estado atual do hook:', { series: series.length, classes: classes.length });

  return { series, classes };
};
