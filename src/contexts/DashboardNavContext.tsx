import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

export const TAB_LABELS: Record<string, string> = {
  reports: 'Relatórios',
  'advanced-reports': 'Relatórios Avançados',
  students: 'Inscritos',
  appointments: 'Agendamentos',
  config: 'Configurações',
};

export const REPORT_SECTIONS = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'meta', label: 'Meta' },
  { id: 'status', label: 'Status' },
  { id: 'funil', label: 'Funil' },
] as const;

export type ReportSectionId = (typeof REPORT_SECTIONS)[number]['id'];

export const ADVANCED_REPORT_SECTIONS = [
  { id: 'filtros', label: 'Filtros', shortLabel: 'Filtros' },
  { id: 'visao-unidade', label: 'Visão por Unidade', shortLabel: 'Unidades' },
  { id: 'evolucao', label: 'Evolução', shortLabel: 'Evolução' },
  { id: 'top-leads', label: 'Top Leads', shortLabel: 'Top Leads' },
  { id: 'conversao', label: 'Conversão', shortLabel: 'Conversão' },
  { id: 'contatos', label: 'Contatos', shortLabel: 'Contatos' },
  { id: 'origens', label: 'Origens', shortLabel: 'Origens' },
] as const;

export type AdvancedReportSectionId = (typeof ADVANCED_REPORT_SECTIONS)[number]['id'];

export const APPOINTMENT_SECTIONS = [
  { id: 'calendar', label: 'Calendário' },
  { id: 'list', label: 'Agendamentos' },
] as const;

export type AppointmentSectionId = (typeof APPOINTMENT_SECTIONS)[number]['id'];

type DashboardNavContextType = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportsActiveSection: ReportSectionId;
  setReportsActiveSection: (section: ReportSectionId) => void;
  reportsScrollToSectionRef: React.MutableRefObject<((id: string) => void) | null>;
  advancedReportsActiveSection: AdvancedReportSectionId;
  setAdvancedReportsActiveSection: (section: AdvancedReportSectionId) => void;
  advancedReportsScrollToSectionRef: React.MutableRefObject<((id: string) => void) | null>;
  appointmentsActiveSection: AppointmentSectionId;
  setAppointmentsActiveSection: (section: AppointmentSectionId) => void;
  appointmentsScrollToSectionRef: React.MutableRefObject<((id: string) => void) | null>;
};

const DashboardNavContext = createContext<DashboardNavContextType | null>(null);

export function DashboardNavProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState('reports');
  const [reportsActiveSection, setReportsActiveSection] = useState<ReportSectionId>(REPORT_SECTIONS[0].id);
  const reportsScrollToSectionRef = useRef<((id: string) => void) | null>(null);
  const [advancedReportsActiveSection, setAdvancedReportsActiveSection] = useState<AdvancedReportSectionId>(
    ADVANCED_REPORT_SECTIONS[0].id
  );
  const advancedReportsScrollToSectionRef = useRef<((id: string) => void) | null>(null);
  const [appointmentsActiveSection, setAppointmentsActiveSection] = useState<AppointmentSectionId>(
    APPOINTMENT_SECTIONS[0].id
  );
  const appointmentsScrollToSectionRef = useRef<((id: string) => void) | null>(null);

  return (
    <DashboardNavContext.Provider
      value={{
        activeTab,
        setActiveTab,
        reportsActiveSection,
        setReportsActiveSection,
        reportsScrollToSectionRef,
        advancedReportsActiveSection,
        setAdvancedReportsActiveSection,
        advancedReportsScrollToSectionRef,
        appointmentsActiveSection,
        setAppointmentsActiveSection,
        appointmentsScrollToSectionRef,
      }}
    >
      {children}
    </DashboardNavContext.Provider>
  );
}

export function useDashboardNav() {
  const context = useContext(DashboardNavContext);
  if (!context) {
    throw new Error('useDashboardNav deve ser usado dentro de DashboardNavProvider');
  }
  return context;
}
