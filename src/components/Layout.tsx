import { ReactNode } from 'react';
import { Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DashboardNavProvider,
  ADVANCED_REPORT_SECTIONS,
  APPOINTMENT_SECTIONS,
  REPORT_SECTIONS,
  TAB_LABELS,
  useDashboardNav,
} from '@/contexts/DashboardNavContext';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileTabNav } from '@/components/MobileTabNav';
import ErrorBoundary from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

function LayoutHeader() {
  const { profile } = useAuth();
  const {
    activeTab,
    reportsActiveSection,
    reportsScrollToSectionRef,
    advancedReportsActiveSection,
    advancedReportsScrollToSectionRef,
    appointmentsActiveSection,
    appointmentsScrollToSectionRef,
  } = useDashboardNav();
  const pageTitle = TAB_LABELS[activeTab] ?? 'Dashboard';
  const isReportsTab = activeTab === 'reports';
  const isAdvancedReportsTab = activeTab === 'advanced-reports';
  const isAppointmentsTab = activeTab === 'appointments';
  const showSectionNav = isReportsTab || isAdvancedReportsTab || isAppointmentsTab;
  const headerSections: readonly { id: string; label: string; shortLabel?: string }[] = isReportsTab
    ? REPORT_SECTIONS
    : isAdvancedReportsTab
      ? ADVANCED_REPORT_SECTIONS
      : isAppointmentsTab
        ? APPOINTMENT_SECTIONS
        : [];
  const headerActiveSection = isReportsTab
    ? reportsActiveSection
    : isAdvancedReportsTab
      ? advancedReportsActiveSection
      : appointmentsActiveSection;
  const handleSectionClick = (id: string) => {
    if (isReportsTab) reportsScrollToSectionRef.current?.(id);
    else if (isAdvancedReportsTab) advancedReportsScrollToSectionRef.current?.(id);
    else if (isAppointmentsTab) appointmentsScrollToSectionRef.current?.(id);
  };
  const useCompactSectionNav = isAdvancedReportsTab;

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:gap-2 sm:px-4',
        showSectionNav ? 'min-h-14 h-auto flex-wrap py-2 md:h-14 md:flex-nowrap md:py-0' : 'h-14'
      )}
    >
      <SidebarTrigger className="shrink-0 md:hidden" />
      <nav
        className={cn(
          'flex min-w-0 shrink items-center gap-1.5 text-sm text-slate-500',
          showSectionNav && useCompactSectionNav && 'hidden lg:flex'
        )}
      >
        <Home className="h-4 w-4 shrink-0 text-[#1437cc]" />
        <span className="text-slate-400">/</span>
        <span className="truncate font-medium text-[#1437cc]">{pageTitle}</span>
      </nav>
      {showSectionNav && (
        <nav
          className={cn(
            'flex min-w-0 w-full basis-full flex-wrap items-center justify-center gap-1 overflow-visible py-0.5',
            'md:w-auto md:basis-auto md:flex-1 md:flex-nowrap md:overflow-hidden md:py-0',
            useCompactSectionNav ? 'md:gap-0.5 lg:gap-1' : 'md:gap-1 md:overflow-x-auto md:px-1 sm:gap-1.5'
          )}
        >
          {headerSections.map(({ id, label, shortLabel }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSectionClick(id)}
              title={label}
              className={cn(
                'shrink-0 rounded-full border font-medium transition-all duration-150',
                useCompactSectionNav
                  ? 'px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px] lg:px-2.5 lg:text-xs'
                  : 'px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm',
                headerActiveSection === id
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-primary/20 bg-white text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground'
              )}
            >
              {useCompactSectionNav && shortLabel ? shortLabel : label}
            </button>
          ))}
        </nav>
      )}
      <div
        className={cn(
          'ml-auto hidden shrink-0 items-center gap-2',
          showSectionNav ? 'lg:flex' : 'sm:flex'
        )}
      >
        <span className="max-w-[160px] truncate text-sm text-slate-700">{profile?.name}</span>
        <span className="rounded-full bg-[#ffac1a]/15 px-2 py-0.5 text-xs font-medium capitalize text-[#1437cc]">
          {profile?.profile}
        </span>
      </div>
    </header>
  );
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <DashboardNavProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar />
        <SidebarInset className="min-h-svh min-w-0 bg-slate-50 max-md:[&_button.fixed.bottom-6.right-6]:bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]">
          <LayoutHeader />
          <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden p-4 pb-20 max-md:pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:p-6 lg:p-8">
            {children}
          </div>
          <ErrorBoundary>
            <MobileTabNav />
          </ErrorBoundary>
        </SidebarInset>
      </SidebarProvider>
    </DashboardNavProvider>
  );
};
