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

type DashboardNavContextType = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportsActiveSection: ReportSectionId;
  setReportsActiveSection: (section: ReportSectionId) => void;
  reportsScrollToSectionRef: React.MutableRefObject<((id: ReportSectionId) => void) | null>;
};

const DashboardNavContext = createContext<DashboardNavContextType | null>(null);

export function DashboardNavProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState('reports');
  const [reportsActiveSection, setReportsActiveSection] = useState<ReportSectionId>(REPORT_SECTIONS[0].id);
  const reportsScrollToSectionRef = useRef<((id: ReportSectionId) => void) | null>(null);

  return (
    <DashboardNavContext.Provider
      value={{
        activeTab,
        setActiveTab,
        reportsActiveSection,
        setReportsActiveSection,
        reportsScrollToSectionRef,
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
