import React from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Confirmation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;

  const classId = state?.classId;
  const hasExam = state?.hasExam;
  const [examDetails, setExamDetails] = useState<Tables<'exam_dates'> & { units: Tables<'units'> } | null>(null);

  useEffect(() => {
    const fetchExamDetails = async () => {
      if (hasExam && classId) {
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('unit_id')
          .eq('id', classId)
          .single();

        if (classError) {
          console.error('Error fetching class details:', classError);
          return;
        }

        if (classData?.unit_id) {
          const { data: examData, error: examError } = await supabase
            .from('exam_dates')
            .select('*, units(*)')
            .eq('unit_id', classData.unit_id)
            .order('exam_date', { ascending: true })
            .limit(1)
            .single();

          if (examError) {
            console.error('Error fetching exam details:', examError);
            return;
          }
          setExamDetails(examData);
        }
      }
    };

    fetchExamDetails();
  }, [hasExam, classId]);

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">Inscrição Confirmada!</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-lg mb-4">
            Sua inscrição foi realizada com sucesso.
          </p>
          {hasExam ? (
            examDetails && (
              <div className="mt-4 p-4 border rounded-md bg-blue-50 dark:bg-blue-900 text-left">
                <h3 className="text-lg font-semibold mb-2">Detalhes do Exame:</h3>
                <p><strong>Data:</strong> {new Date(examDetails.exam_date).toLocaleDateString('pt-BR')}</p>
                <p><strong>Hora:</strong> {examDetails.exam_time.substring(0, 5)}</p>
                <p><strong>Unidade:</strong> {examDetails.units?.name}</p>
                <p><strong>Endereço:</strong> {examDetails.units?.address}</p>
              </div>
            )
          ) : (
            <div className="mt-4 p-4 border rounded-md bg-green-50 dark:bg-green-900 text-left">
              <h3 className="text-lg font-semibold mb-2">Próxima Etapa:</h3>
              <p>A próxima etapa do processo é uma entrevista com o responsável na unidade.</p>
            </div>
          )}
          <Button onClick={() => navigate('/inscricao')} className="mt-6">
            Inscrever Outro Aluno
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;