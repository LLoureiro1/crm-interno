
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type City = Tables<'cities'>;
type Unit = Tables<'units'>;
type Serie = Tables<'series'>;
type Class = Tables<'classes'> & {
  series: Serie;
  units: Unit;
};

export const useRegistrationData = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const loadInitialData = async () => {
    try {
      // Carregar todas as cidades (removido o limite)
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .order('name');

      if (citiesError) throw citiesError;
      setCities(citiesData || []);
      console.log(`Carregadas ${citiesData?.length || 0} cidades`);

      // Carregar séries
      const { data: seriesData, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .order('name');

      if (seriesError) throw seriesError;
      setSeries(seriesData || []);

      // Carregar turmas com relacionamentos
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          series (*),
          units (*)
        `)
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      toast.error('Erro ao carregar dados do formulário');
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  return { cities, series, classes };
};
