import { ReactNode } from 'react';
import { Home, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DashboardNavProvider,
  REPORT_SECTIONS,
  TAB_LABELS,
  useDashboardNav,
} from '@/contexts/DashboardNavContext';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

function SidebarMenuToggle() {
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();
  const isOpen = isMobile ? openMobile : open;
  const label = isOpen ? 'Fechar menu' : 'Abrir menu';

  return (
    <Button
      type="button"
      variant={isMobile ? 'ghost' : 'outline'}
      size={isMobile ? 'icon' : 'sm'}
      onClick={toggleSidebar}
      className={
        isMobile
          ? 'h-10 w-10 shrink-0 text-[#1437cc] hover:bg-[#1437cc]/10'
          : 'shrink-0 gap-2 border-[#1437cc]/25 text-[#1437cc] hover:bg-[#1437cc]/10 hover:text-[#1437cc]'
      }
      aria-label={`${label} lateral`}
      aria-expanded={isOpen}
      title={`${label} lateral`}
    >
      <Menu className="h-5 w-5" aria-hidden />
      <span className="sr-only">{label}</span>
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}

function LayoutHeader() {
  const { profile } = useAuth();
  const { activeTab, reportsActiveSection, reportsScrollToSectionRef } = useDashboardNav();
  const pageTitle = TAB_LABELS[activeTab] ?? 'Dashboard';
  const isReportsTab = activeTab === 'reports';

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-3">
      <SidebarMenuToggle />
      <nav className="flex min-w-0 shrink items-center gap-1.5 text-sm text-slate-500">
        <Home className="h-4 w-4 shrink-0 text-[#1437cc]" />
        <span className="text-slate-400">/</span>
        <span className="truncate font-medium text-[#1437cc]">{pageTitle}</span>
      </nav>
      {isReportsTab && (
        <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-1 sm:gap-1.5">
          {REPORT_SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => reportsScrollToSectionRef.current?.(id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 sm:px-4 sm:py-1.5 sm:text-sm',
                reportsActiveSection === id
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-primary/20 bg-white text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className={cn('ml-auto hidden shrink-0 items-center gap-2', isReportsTab ? 'lg:flex' : 'sm:flex')}>
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
        <SidebarInset className="min-h-svh min-w-0 bg-slate-50">
          <LayoutHeader />
          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </DashboardNavProvider>
  );
};
