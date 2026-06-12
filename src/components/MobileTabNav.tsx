import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Calendar,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDashboardNav } from '@/contexts/DashboardNavContext';
import { cn } from '@/lib/utils';

type TabItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function MobileTabNav() {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const { activeTab, setActiveTab } = useDashboardNav();

  const canAccessAdvancedReports =
    profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';

  const items = useMemo<TabItem[]>(() => {
    const tabs: TabItem[] = [
      { id: 'reports', label: 'Painel', icon: BarChart3 },
    ];

    if (canAccessAdvancedReports) {
      tabs.push({ id: 'advanced-reports', label: 'Estratégico', icon: TrendingUp });
    }

    tabs.push(
      { id: 'students', label: 'Inscritos', icon: Users },
      { id: 'appointments', label: 'Agenda', icon: Calendar },
    );

    if (canAccessConfig) {
      tabs.push({ id: 'config', label: 'Config', icon: Settings });
    }

    return tabs;
  }, [canAccessAdvancedReports, canAccessConfig]);

  if (!isMobile) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-lg pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around">
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-slate-500'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
