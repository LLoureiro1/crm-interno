import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRescheduleAccess } from '@/integrations/supabase/schedulingRpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { SelfScheduling } from '@/components/registration/SelfScheduling';
import { APP_CONFIG } from '@/config/appConfig';

type RescheduleAccess = {
  success?: boolean;
  eligible?: boolean;
  error?: string;
  reason?: string;
  student_id?: string;
  student_name?: string;
  unit_id?: string;
  class_id?: string;
  unit_name?: string;
  unit_address?: string;
};

const Reschedule: React.FC = () => {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('s') || '';
  const registrationToken = searchParams.get('t') || '';

  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<RescheduleAccess | null>(null);
  const [confirmed, setConfirmed] = useState<{
    date: string;
    time: string;
    unitName?: string;
    unitAddress?: string;
  } | null>(null);

  useEffect(() => {
    const validateAccess = async () => {
      if (!studentId || !registrationToken) {
        setAccess({ success: false, error: 'Link incompleto. Use o link recebido por e-mail.' });
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await getRescheduleAccess(studentId, registrationToken);

        if (error) throw error;
        setAccess(data as RescheduleAccess);
      } catch (err) {
        console.error('Erro ao validar reagendamento:', err);
        setAccess({ success: false, error: 'Não foi possível validar o link. Tente novamente mais tarde.' });
      } finally {
        setLoading(false);
      }
    };

    validateAccess();
  }, [studentId, registrationToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!access?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Link inválido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{access?.error || 'Este link não está disponível.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!access.eligible) {
    const message =
      access.reason === 'reagendamento_ja_utilizado'
        ? 'Este link de reagendamento já foi utilizado. Entre em contato com a unidade para agendar um novo horário.'
        : access.reason === 'status_nao_permite'
          ? 'Seu cadastro não está elegível para reagendamento online no momento.'
          : 'Reagendamento não disponível.';

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Reagendamento indisponível</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 py-8">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Reagendar atendimento — {APP_CONFIG.SCHOOL_NAME}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {confirmed ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-left">
              <h3 className="mb-2 text-lg font-semibold text-green-800">Novo horário confirmado!</h3>
              <p className="mb-2">Esperamos você e sua família para o atendimento.</p>
              <p><strong>Aluno:</strong> {access.student_name}</p>
              <p><strong>Data:</strong> {new Date(confirmed.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              <p><strong>Horário:</strong> {confirmed.time}</p>
              <p><strong>Unidade:</strong> {confirmed.unitName || access.unit_name}</p>
              <p><strong>Endereço:</strong> {confirmed.unitAddress || access.unit_address}</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-center text-gray-600">
                Olá! Escolha um novo horário para o atendimento de <strong>{access.student_name}</strong>.
                Este link permite <strong>apenas um reagendamento</strong>.
              </p>
              {access.unit_id && access.class_id && access.student_id && (
                <SelfScheduling
                  mode="reschedule"
                  unitId={access.unit_id}
                  classId={access.class_id}
                  studentId={access.student_id}
                  registrationToken={registrationToken}
                  unitName={access.unit_name}
                  unitAddress={access.unit_address}
                  onSuccess={setConfirmed}
                  fallback={
                    <p className="rounded-md border bg-yellow-50 p-4 text-yellow-800">
                      Não há horários disponíveis no momento. Entre em contato com a unidade.
                    </p>
                  }
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reschedule;
