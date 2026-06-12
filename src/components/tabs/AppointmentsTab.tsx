
import { useCallback, useEffect, useState } from 'react';
import AppointmentCalendar from '@/components/appointments/AppointmentCalendar';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentDate } from '@/utils/dateUtils';
import {
  APPOINTMENT_SECTIONS,
  type AppointmentSectionId,
  useDashboardNav,
} from '@/contexts/DashboardNavContext';

export const AppointmentsTab = () => {
  const [todayCount, setTodayCount] = useState(0);
  const {
    setAppointmentsActiveSection,
    appointmentsScrollToSectionRef,
  } = useDashboardNav();

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

  useEffect(() => {
    const navOffset = 64;

    const getActiveSectionId = (): AppointmentSectionId => {
      const sections = APPOINTMENT_SECTIONS.map(({ id }) => ({
        id,
        element: document.getElementById(id),
      })).filter((section): section is { id: AppointmentSectionId; element: HTMLElement } => !!section.element);

      if (sections.length === 0) return APPOINTMENT_SECTIONS[0].id;

      const scrollBottom = window.scrollY + window.innerHeight;
      const pageBottom = document.documentElement.scrollHeight;
      const atPageBottom = pageBottom - scrollBottom <= 80;

      if (atPageBottom) {
        return sections[sections.length - 1].id;
      }

      let activeId = sections[0].id;

      for (const { id, element } of sections) {
        if (element.getBoundingClientRect().top <= navOffset) {
          activeId = id;
        }
      }

      return activeId;
    };

    const handleScroll = () => {
      setAppointmentsActiveSection(getActiveSectionId());
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [setAppointmentsActiveSection]);

  const scrollToSection = useCallback((sectionId: AppointmentSectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAppointmentsActiveSection(sectionId);
  }, [setAppointmentsActiveSection]);

  useEffect(() => {
    appointmentsScrollToSectionRef.current = scrollToSection;
    return () => {
      appointmentsScrollToSectionRef.current = null;
    };
  }, [scrollToSection, appointmentsScrollToSectionRef]);

  useEffect(() => {
    setAppointmentsActiveSection(APPOINTMENT_SECTIONS[0].id);
  }, [setAppointmentsActiveSection]);

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

      <AppointmentCalendar view="full" onTodayCountChange={setTodayCount} />
    </div>
  );
};
