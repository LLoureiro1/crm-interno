import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';

interface AcademicYearFilterProps {
  value?: string;
  onValueChange: (value: string) => void;
  className?: string;
  showLabel?: boolean;
}

export const AcademicYearFilter = ({ 
  value, 
  onValueChange, 
  className = "",
  showLabel = true 
}: AcademicYearFilterProps) => {
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Função para calcular o ano letivo vigente
  const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Se estamos entre agosto e dezembro, o ano letivo vigente é o próximo ano
    if (currentMonth >= 8) {
      return (currentYear + 1).toString();
    }
    // Se estamos entre janeiro e julho, o ano letivo vigente é o ano atual
    return currentYear.toString();
  };

  useEffect(() => {
    fetchAvailableAcademicYears();
  }, []);

  const fetchAvailableAcademicYears = async () => {
    try {
      setLoading(true);
      
      // Buscar anos letivos únicos dos alunos existentes
      const { data, error } = await supabase
        .from('students')
        .select('ano_letivo')
        .not('ano_letivo', 'is', null);

      if (error) {
        console.error('Erro ao buscar anos letivos:', error);
        return;
      }

      // Extrair anos únicos e ordenar
      const uniqueYears = [...new Set(data?.map(item => item.ano_letivo) || [])]
        .filter(year => year && year.trim() !== '')
        .sort((a, b) => b.localeCompare(a)); // Ordem decrescente (mais recente primeiro)

      // Adicionar o ano letivo vigente se não estiver na lista
      const currentYear = getCurrentAcademicYear();
      if (!uniqueYears.includes(currentYear)) {
        uniqueYears.unshift(currentYear);
      }

      setAvailableYears(uniqueYears);
      
      // Se não há valor selecionado, usar o ano vigente
      if (!value && uniqueYears.length > 0) {
        onValueChange(currentYear);
      }
    } catch (error) {
      console.error('Erro ao buscar anos letivos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {showLabel && <Label>Ano Letivo</Label>}
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Carregando..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && <Label>Ano Letivo</Label>}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o ano letivo" />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map(year => (
            <SelectItem key={year} value={year}>
              {year}
              {year === getCurrentAcademicYear() && ' (Vigente)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
