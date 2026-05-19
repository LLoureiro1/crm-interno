import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardNav, TAB_LABELS } from '@/contexts/DashboardNavContext';
import { ReportsTab } from './tabs/ReportsTab';
import { StudentsMainTab } from './tabs/StudentsMainTab';
import { AppointmentsTab } from './tabs/AppointmentsTab';
import { ConfigTab } from './tabs/ConfigTab';
import { AdvancedReportsTab } from './tabs/AdvancedReportsTab';
import ErrorBoundary from './ErrorBoundary';

export const Dashboard = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const { activeTab, setActiveTab } = useDashboardNav();

  const canAccessAdvancedReports =
    profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';

  useEffect(() => {
    const navigationState = location.state as { activeTab?: string };
    if (navigationState?.activeTab) {
      setActiveTab(navigationState.activeTab);
    }
  }, [location.state, setActiveTab]);

  useEffect(() => {
    if (activeTab === 'advanced-reports' && !canAccessAdvancedReports) {
      setActiveTab('reports');
    }
    if (activeTab === 'config' && !canAccessConfig) {
      setActiveTab('reports');
    }
  }, [activeTab, canAccessAdvancedReports, canAccessConfig, setActiveTab]);

  const pageTitle = TAB_LABELS[activeTab] ?? 'Dashboard';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
        <p className="text-slate-600">Bem-vindo ao Laurel Escolar</p>
      </div>

      {activeTab === 'reports' && (
        <ErrorBoundary>
          <ReportsTab />
        </ErrorBoundary>
      )}

      {activeTab === 'advanced-reports' && canAccessAdvancedReports && (
        <ErrorBoundary>
          <AdvancedReportsTab />
        </ErrorBoundary>
      )}

      {activeTab === 'students' && (
        <ErrorBoundary>
          <StudentsMainTab />
        </ErrorBoundary>
      )}

      {activeTab === 'appointments' && (
        <ErrorBoundary>
          <AppointmentsTab />
        </ErrorBoundary>
      )}

      {activeTab === 'config' && canAccessConfig && (
        <ErrorBoundary>
          <ConfigTab />
        </ErrorBoundary>
      )}
    </div>
  );
};
