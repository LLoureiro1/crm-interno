import { useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardNav } from '@/contexts/DashboardNavContext';
import { cn } from '@/lib/utils';

type TabItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function MobileTabNav() {
  const { profile } = useAuth();
  const { activeTab, setActiveTab } = useDashboardNav();

  const canAccessAdvancedReports =
    profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';

  const items = useMemo<TabItem[]>(
    () => [
      { id: 'reports', label: 'Painel', icon: BarChart3 },
      ...(canAccessAdvancedReports
        ? [{ id: 'advanced-reports', label: 'Estratégico', icon: TrendingUp }]
        : []),
      { id: 'students', label: 'Inscritos', icon: Users },
      { id: 'appointments', label: 'Agenda', icon: Calendar },
      ...(canAccessConfig ? [{ id: 'config', label: 'Config', icon: Settings }] : []),
    ],
    [canAccessAdvancedReports, canAccessConfig]
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)] md:hidden"
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
                isActive ? 'text-primary' : 'text-slate-500 hover:text-primary'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
