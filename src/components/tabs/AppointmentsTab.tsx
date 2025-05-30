
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const AppointmentsTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Gestão de Agendamentos</h2>
        <p className="text-gray-600">Visualize e gerencie todos os agendamentos de entrevistas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agenda de Hoje</CardTitle>
          <CardDescription>Agendamentos para hoje</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Nenhum agendamento para hoje</p>
        </CardContent>
      </Card>
    </div>
  );
};
