import { createContext, useContext, useState, type ReactNode } from 'react';

export const TAB_LABELS: Record<string, string> = {
  reports: 'Relatórios',
  'advanced-reports': 'Relatórios Avançados',
  students: 'Inscritos',
  appointments: 'Agendamentos',
  config: 'Configurações',
};

type DashboardNavContextType = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const DashboardNavContext = createContext<DashboardNavContextType | null>(null);

export function DashboardNavProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState('reports');

  return (
    <DashboardNavContext.Provider value={{ activeTab, setActiveTab }}>
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
