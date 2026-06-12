
import { useEffect, useState } from 'react';
import AppointmentCalendar from '@/components/appointments/AppointmentCalendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentDate } from '@/utils/dateUtils';

const tabTriggerClassName = cn(
  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-none transition-colors',
  'data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
  'data-[state=inactive]:border-gray-200 data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600'
);

export const AppointmentsTab = () => {
  const [todayCount, setTodayCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => {
    const fetchTodayCount = async () => {
      const today = getCurrentDate();
      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('appointment_date', today);

      if (!error && count !== null) {
        setTodayCount(count);
      }
    };

    fetchTodayCount();
  }, []);

  return (
    <div className="relative -mt-2 min-w-0 w-full max-w-none md:-mt-4 lg:-mt-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
            <Calendar className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Gestão de Agendamentos</h2>
            <p className="text-sm text-muted-foreground">
              Visualize e gerencie todos os agendamentos de entrevistas
            </p>
          </div>
        </div>
        <div className="flex items-center rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-primary">
            {todayCount} agendamento{todayCount !== 1 ? 's' : ''} hoje
          </span>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'calendar' | 'list')}
        className="min-w-0 space-y-4"
      >
        <TabsList className="h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="calendar" className={tabTriggerClassName}>
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="list" className={tabTriggerClassName}>
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span>Agendamentos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-0">
          <AppointmentCalendar view="full" onTodayCountChange={setTodayCount} />
        </TabsContent>
        <TabsContent value="list" className="mt-0">
          <AppointmentCalendar view="list" onTodayCountChange={setTodayCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
