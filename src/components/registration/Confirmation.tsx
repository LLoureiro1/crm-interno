import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Confirmation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;

  const classId = state?.classId;
  const hasExam = state?.hasExam;

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
          {classId && (
            <p className="text-md mb-2">
              Você foi inscrito na turma: <strong>{classId}</strong>
            </p>
          )}
          {hasExam && (
            <p className="text-md mb-4">
              Você precisará realizar um exame de nivelamento.
            </p>
          )}
          <Button onClick={handleGoHome} className="mt-6">
            Voltar para a Página Inicial
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;