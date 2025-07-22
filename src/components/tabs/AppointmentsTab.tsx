
import { AppointmentCalendar } from '@/components/appointments/AppointmentCalendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const AppointmentsTab = () => {
  const handleCheckMissedInterviews = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-missed-interviews');
      
      if (error) throw error;
      
      toast.success(`Verificação concluída: ${data.updated_students || 0} alunos atualizados`);
    } catch (error) {
      console.error('Error checking missed interviews:', error);
      toast.error('Erro ao verificar entrevistas perdidas');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Gestão de Agendamentos</h2>
          <p className="text-gray-600">Visualize e gerencie todos os agendamentos de entrevistas</p>
        </div>
        <Button 
          onClick={handleCheckMissedInterviews}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Verificar Entrevistas Perdidas
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Calendário de Agendamentos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AppointmentCalendar />
        </CardContent>
      </Card>
    </div>
  );
};
