import React from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCurrentDate } from '@/utils/dateUtils';
import { SelfScheduling } from './SelfScheduling';
import { APP_CONFIG } from '@/config/appConfig';
import { getRegistrationToken } from '@/utils/registrationToken';


const Confirmation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;

  const classId = state?.classId;
  const hasExam = state?.hasExam;
  const studentId = state?.studentId;
  const unitIdState = state?.unitId;
  const registrationToken = state?.registrationToken
    || (studentId ? getRegistrationToken(studentId) : null);

  const [examDetails, setExamDetails] = useState<Tables<'exam_dates'> & { units: Tables<'units'> } | null>(null);
  const [unit, setUnit] = useState<Tables<'units'> | null>(null);
  const [appointmentConfirmed, setAppointmentConfirmed] = useState<{
    date: string;
    time: string;
    unitName?: string;
    unitAddress?: string;
  } | null>(null);
  const [hasAvailabilities, setHasAvailabilities] = useState(true);

  useEffect(() => {
    const fetchExamDetails = async () => {
      console.log('Confirmation useEffect:', { classId, unitIdState, hasExam });

      // Se não tivermos nem turma nem unidade, não há o que buscar
      if (!classId && !unitIdState) return;

      let currentUnitId = unitIdState;

      // 1. Se não temos unitId mas temos classId, buscar unidade a partir da turma
      if (!currentUnitId && classId) {
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('unit_id')
          .eq('id', classId)
          .maybeSingle();

        if (classError) {
          console.error('Error fetching class details:', classError);
        } else if (classData) {
          currentUnitId = classData.unit_id;
        }
      }

      // Se ainda não temos unitId, abortar
      if (!currentUnitId) return;

      if (hasExam) {
        // Se houver exame, buscar o próximo exame e já obter os dados da unidade
        const { data: examData, error: examError } = await supabase
          .from('exam_dates')
          .select('*, units(*)')
          .eq('unit_id', currentUnitId)
          .gte('exam_date', getCurrentDate())
          .order('exam_date', { ascending: true })
          .limit(5);

        if (examError) {
          console.error('Error fetching exam details:', examError);
        } else if (examData && examData.length > 0) {
          const now = new Date();
          const todayStr = getCurrentDate();
          const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

          const validExam = examData.find(exam => {
            if (exam.exam_date > todayStr) return true;
            if (exam.exam_date === todayStr && exam.exam_time && exam.exam_time > currentTimeStr) return true;
            return false;
          });

          if (validExam) {
            setExamDetails(validExam);
            // Guardar a unidade também, se disponível
            const unitsFromExam = (validExam as unknown as { units?: Tables<'units'> }).units;
            if (unitsFromExam) setUnit(unitsFromExam);
          }
        }
      }

      // Independente de haver exame, garantir que temos os dados da unidade para exibir endereço/telefone
      if (!unit) {
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('*')
          .eq('id', currentUnitId)
          .maybeSingle();

        if (unitError) {
          console.error('Error fetching unit details:', unitError);
        } else if (unitData) {
          setUnit(unitData);
        }
      }
    };

    fetchExamDetails();
  }, [hasExam, classId, unitIdState, unit]);

  const handleGoHome = () => {
    navigate('/');
  };

  // Construir link do WhatsApp com telefone da unidade
  const unitPhoneRaw = unit?.phone || examDetails?.units?.phone || '';
  const unitPhoneDigits = unitPhoneRaw.replace(/\D/g, '');
  const waPhone = unitPhoneDigits
    ? (unitPhoneDigits.startsWith('55') ? unitPhoneDigits : `55${unitPhoneDigits}`)
    : '';
  const whatsappHref = waPhone ? `https://wa.me/${waPhone}` : 'https://wa.me/5532984770624';

  const fallbackContent = (
    <div className="mt-4 p-4 border rounded-md bg-green-50 dark:bg-green-900 text-left">
      <h3 className="text-lg font-semibold mb-2">Fique de olho no telefone!</h3>
      <p>Em breve, entraremos em contato com você para agendar um momento especial de acolhimento da sua família na unidade.</p>
      <br></br>
      <p>Será uma conversa leve e próxima, onde poderemos conhecer um pouco mais sobre quem irá estudar conosco, entender sua história e apresentar tudo o que a {APP_CONFIG.SCHOOL_NAME} pode oferecer.</p>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">🎉 Parabéns! Sua inscrição foi realizada com sucesso!</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-lg mb-3">
            {hasExam ? (
              <>
                Este é o primeiro passo para garantir um futuro cheio de conquistas!
                Estamos te esperando de braços abertos em nossa unidade!
              </>
            ) : (
              <>Estamos muito felizes em ter você conosco!</>
            )}
          </p>

          {hasExam ? (
            examDetails && (
              <div className="mt-4 p-4 border rounded-md bg-blue-50 dark:bg-blue-900 text-left">
                <h3 className="text-lg font-semibold mb-2">Detalhes da Prova:</h3>
                <p><strong>Data:</strong> {new Date(examDetails.exam_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                <p><strong>Hora:</strong> {examDetails.exam_time.substring(0, 5)}</p>
                <p><strong>Unidade:</strong> {examDetails.units?.name}</p>
                <p><strong>Endereço:</strong> {examDetails.units?.address}</p>
              </div>
            )
          ) : (
            appointmentConfirmed ? (
              <div className="mt-4 p-4 border rounded-md bg-green-50 dark:bg-green-900 text-left">
                <h3 className="text-lg font-semibold mb-2 text-green-800">Agendamento Confirmado!</h3>
                <p className="mb-2">Esperamos você e sua família para um bate-papo especial.</p>
                <div className="bg-white p-3 rounded border border-green-200">
                  <p><strong>Data:</strong> {new Date(appointmentConfirmed.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  <p><strong>Horário:</strong> {appointmentConfirmed.time}</p>
                  <p><strong>Unidade:</strong> {appointmentConfirmed.unitName || unit?.name}</p>
                  <p><strong>Endereço:</strong> {appointmentConfirmed.unitAddress || unit?.address}</p>
                </div>
              </div>
            ) : (
              studentId && (classId || unitIdState) && unit && registrationToken && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-left mb-2">Próximo Passo: Agendar seu horário de atendimento</h3>
                  <SelfScheduling
                    unitId={unit.id}
                    classId={classId || ''}
                    studentId={studentId}
                    registrationToken={registrationToken}
                    unitName={unit.name}
                    unitAddress={unit.address}
                    onSuccess={setAppointmentConfirmed}
                    onAvailabilitiesLoaded={setHasAvailabilities}
                    fallback={fallbackContent}
                  />
                </div>
              )
            )
          )}

          {/* Fallback para quando tem exame mas não achou detalhes (ex: sem datas futuras) */}
          {hasExam && !examDetails && (
            <div className="mt-4 p-4 border rounded-md bg-yellow-50 dark:bg-yellow-900 text-left">
              <h3 className="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Aguardando Agendamento de Prova</h3>
              <p className="text-yellow-700 dark:text-yellow-300">
                Sua turma requer uma prova de admissão, mas não encontramos datas disponíveis no momento.
                Nossa equipe entrará em contato em breve para agendar sua avaliação.
              </p>
            </div>
          )}

          {/* Show fallback if data is missing or if logic falls through (though SelfScheduling handles fallback) */}
          {!hasExam && !appointmentConfirmed && (!studentId || !classId || !unit || !registrationToken) && fallbackContent}

          <Button onClick={() => navigate('/inscricao')} className="mt-6">
            Inscrever Outro Aluno
          </Button>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {!hasExam && !appointmentConfirmed && studentId && (classId || unitIdState) && unit && registrationToken && hasAvailabilities ? (
                "💬 Nenhuma das opções de horário apresentadas te atende? Clique no botão abaixo e fale diretamente com nossa equipe pelo WhatsApp:"
              ) : (
                "💬 Quer falar com a gente agora mesmo? Clique no botão abaixo e fale diretamente com nossa equipe pelo WhatsApp:"
              )}
            </p>
            <Button
              asChild
              variant="outline"
              className="w-full bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
            >
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                </svg>
                Falar com nossa equipe
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;