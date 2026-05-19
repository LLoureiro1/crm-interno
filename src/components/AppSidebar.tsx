import { useEffect, useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardNav } from '@/contexts/DashboardNavContext';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const menuButtonClass =
  'text-white/90 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#ffac1a] data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm rounded-lg';

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { activeTab, setActiveTab } = useDashboardNav();
  const { state, toggleSidebar } = useSidebar();
  const [inscricaoLink, setInscricaoLink] = useState('/inscricao');

  const canAccessAdvancedReports =
    profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';

  const gestaoItems: NavItem[] = [
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    ...(canAccessAdvancedReports
      ? [{ id: 'advanced-reports', label: 'Relatórios Avançados', icon: TrendingUp }]
      : []),
    { id: 'students', label: 'Inscritos', icon: Users },
    { id: 'appointments', label: 'Agendamentos', icon: Calendar },
  ];

  const sistemaItems: NavItem[] = canAccessConfig
    ? [{ id: 'config', label: 'Configurações', icon: Settings }]
    : [];

  useEffect(() => {
    const computeInscricaoLink = async () => {
      try {
        if (!profile?.unit_id) {
          setInscricaoLink('/inscricao');
          return;
        }

        const { data: userUnit, error } = await supabase
          .from('units')
          .select('id, name, slug')
          .eq('id', profile.unit_id)
          .maybeSingle();

        if (error) {
          setInscricaoLink('/inscricao');
          return;
        }

        const unitName = (userUnit?.name || '').toLowerCase();
        const isCentral = unitName === 'central';
        const slug = (userUnit as { slug?: string | null })?.slug;

        setInscricaoLink(!isCentral && slug ? `/inscricao/${slug}` : '/inscricao');
      } catch {
        setInscricaoLink('/inscricao');
      }
    };

    computeInscricaoLink();
  }, [profile?.unit_id]);

  const renderNavGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;

    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-white/45 px-3">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                  tooltip={item.label}
                  className={menuButtonClass}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[#0f2ba3] [&_[data-sidebar=sidebar]]:bg-[#1437cc]"
    >
      <SidebarHeader className="border-b border-white/10 p-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src="/logo_apogeu_nobg.png"
            alt="Apogeu"
            className="h-9 w-auto max-w-[2.25rem] shrink-0 object-contain group-data-[collapsible=icon]:max-w-8"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold leading-tight text-white">APOGEU</p>
            <p className="truncate text-[11px] text-white/60">Laurel Escolar</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        {renderNavGroup('Gestão', gestaoItems)}
        {renderNavGroup('Sistema', sistemaItems)}

        <SidebarGroup className="mt-2 group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent className="px-2">
            <a
              href={inscricaoLink}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffac1a] px-3 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#e89b0f]"
            >
              <UserPlus className="h-4 w-4" />
              <span>Nova Inscrição</span>
            </a>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-2">
        <div className="flex flex-col gap-2 px-1 group-data-[collapsible=icon]:items-center">
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium text-white">{profile?.name}</p>
            <p className="truncate text-xs capitalize text-white/55">{profile?.profile}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">Sair</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white md:flex"
            title={state === 'expanded' ? 'Recolher menu' : 'Expandir menu'}
          >
            {state === 'expanded' ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail className="hover:after:bg-[#ffac1a]/50" />
    </Sidebar>
  );
}
