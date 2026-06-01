import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardNav } from '@/contexts/DashboardNavContext';
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

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
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
