import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface ReactivateStudentButtonProps {
  student: Tables<'students'> & {
    classes: Tables<'classes'> & {
      series: Tables<'series'>;
      units: Tables<'units'>;
    };
  };
  onSuccess: () => void;
  className?: string;
}

export const ReactivateStudentButton: React.FC<ReactivateStudentButtonProps> = ({ 
  student, 
  onSuccess,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  // Função para calcular o ano letivo atual
  const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Se é agosto ou depois, o ano letivo é o próximo ano
    if (currentMonth >= 8) {
      return currentYear + 1;
    }
    // Caso contrário, é o ano atual
    return currentYear;
  };

  // Função para encontrar a próxima série
  const findNextSeries = async (currentSeriesId: string, unitId: string) => {
    try {
      // Buscar a série atual
      const { data: currentSeries } = await supabase
        .from('series')
        .select('*')
        .eq('id', currentSeriesId)
        .single();

      if (!currentSeries) return null;

      // Buscar todas as séries do mesmo nível
      const { data: allSeries } = await supabase
        .from('series')
        .select('*')
        .eq('level', currentSeries.level)
        .order('name');

      if (!allSeries) return null;

      // Encontrar a posição da série atual
      const currentIndex = allSeries.findIndex(s => s.id === currentSeriesId);
      if (currentIndex === -1 || currentIndex === allSeries.length - 1) {
        return null; // Não há próxima série
      }

      const nextSeries = allSeries[currentIndex + 1];

      // Verificar se existe turma da próxima série na mesma unidade
      const { data: nextClass } = await supabase
        .from('classes')
        .select('id, has_exam')
        .eq('series_id', nextSeries.id)
        .eq('unit_id', unitId)
        .single();

      return nextClass ? { series: nextSeries, class: nextClass } : null;
    } catch (error) {
      console.error('Erro ao buscar próxima série:', error);
      return null;
    }
  };

  // Função para buscar próxima data de exame
  const findNextExamDate = async (unitId: string) => {
    try {
      const { data: examDates } = await supabase
        .from('exam_dates')
        .select('*')
        .eq('unit_id', unitId)
        .gte('exam_date', new Date().toISOString().split('T')[0])
        .order('exam_date', { ascending: true })
        .limit(1);

      return examDates?.[0] || null;
    } catch (error) {
      console.error('Erro ao buscar próxima data de exame:', error);
      return null;
    }
  };

  const handleReactivate = async () => {
    setLoading(true);
    setShowAlert(false);
    
    try {
      const currentAcademicYear = getCurrentAcademicYear();
      const previousYear = student.ano_letivo;
      
      // Verificar se o aluno já está no ano letivo atual
      if (Number(student.ano_letivo) >= currentAcademicYear) {
        toast.error('Este aluno já está no ano letivo atual');
        return;
      }

      // Buscar próxima série/turma
      const nextSeriesData = await findNextSeries(student.classes.series_id, student.classes.unit_id);
      
      if (!nextSeriesData) {
        setShowAlert(true);
        toast.error('Não foi possível encontrar a próxima série. Ajuste a turma manualmente.');
        return;
      }

      // Preparar dados para atualização
      const updateData: any = {
        ano_letivo: currentAcademicYear,
        tag: `Inscrito para ${previousYear}`,
        class_id: nextSeriesData.class.id,
        status: nextSeriesData.class.has_exam ? 'nao_confirmado' : 'nenhum_agendamento'
      };

      // Se a nova turma tem prova, buscar próxima data de exame
      if (nextSeriesData.class.has_exam) {
        const nextExamDate = await findNextExamDate(student.classes.unit_id);
        if (nextExamDate) {
          updateData.exam_date_id = nextExamDate.id;
        }
      } else {
        // Se a nova turma não tem prova, limpar exam_date_id
        updateData.exam_date_id = null;
      }

      // Atualizar o aluno
      const { error: updateError } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id);

      if (updateError) {
        throw updateError;
      }

      // Adicionar interação
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('student_interactions')
          .insert({
            student_id: student.id,
            user_id: user.id,
            interaction_type: 'reativacao',
            comments: `Aluno reativado do ano letivo ${previousYear} para ${currentAcademicYear}. Série alterada de ${student.classes.series.name} para ${nextSeriesData.series.name}.`
          });
      }

      toast.success('Aluno reativado com sucesso!');
      onSuccess();
      
    } catch (error) {
      console.error('Erro ao reativar aluno:', error);
      toast.error('Erro ao reativar aluno');
    } finally {
      setLoading(false);
    }
  };

  const currentAcademicYear = getCurrentAcademicYear();
  const shouldShowButton = Number(student.ano_letivo) < currentAcademicYear;

  // 🔍 DEBUG LOGS
  console.log('═══════════════════════════════════════');
  console.log('🔍 ReactivateStudentButton Debug:');
  console.log('📚 Ano letivo atual:', currentAcademicYear);
  console.log('👤 Ano letivo do aluno:', student.ano_letivo);
  console.log('📊 Tipo de ano_letivo do aluno:', typeof student.ano_letivo);
  console.log('📊 Tipo de ano atual:', typeof currentAcademicYear);
  console.log('🔢 Comparação (ano_letivo < ano_atual):', Number(student.ano_letivo), '<', currentAcademicYear, '=', Number(student.ano_letivo) < currentAcademicYear);
  console.log('✅ Deve mostrar botão:', shouldShowButton);
  console.log('👤 Nome do aluno:', student.student_name);
  console.log('🏫 Série:', student.classes.series.name);
  console.log('═══════════════════════════════════════');

  if (!shouldShowButton) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {showAlert && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível encontrar a próxima série automaticamente. 
            Por favor, ajuste a turma do aluno manualmente após a reativação.
          </AlertDescription>
        </Alert>
      )}
      
      <Button
        onClick={handleReactivate}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Reativando...' : `Reativar para ${currentAcademicYear}`}
      </Button>
    </div>
  );
};
