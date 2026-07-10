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
  MessageCircle,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useWhatsappAccess } from '@/hooks/useWhatsappAccess';
import { getRegistrationLinkForUnit } from '@/utils/registrationUnitGroups';

const menuButtonClass =
  'group/nav-btn relative h-auto gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-sm text-white/90 shadow-none transition-all hover:bg-white/10 hover:!text-white hover:shadow-sm focus-visible:bg-white/10 focus-visible:!text-white focus-visible:ring-2 focus-visible:ring-[#ffac1a]/40 active:bg-white/15 active:!text-white data-[active=true]:!bg-[#ffac1a] data-[active=true]:!text-white data-[active=true]:font-semibold data-[active=true]:shadow-md group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:!rounded-lg group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:hover:bg-white/10 data-[active=true]:group-data-[collapsible=icon]:shadow-sm';

const navIconBoxClass =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 transition-colors group-data-[active=true]/nav-btn:bg-white/20 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:rounded-none group-data-[collapsible=icon]:bg-transparent';

const sectionCardClass =
  'rounded-lg bg-white/[0.04] p-1.5 ring-1 ring-white/10 shadow-sm group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:bg-white/[0.08] group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:ring-white/[0.12]';

const footerActionClass =
  'h-auto w-full justify-start gap-2 rounded-lg px-2 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0';

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { activeTab, setActiveTab } = useDashboardNav();
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const [inscricaoLink, setInscricaoLink] = useState('/inscricao');

  const closeMobileMenu = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    closeMobileMenu();
  };

  const canAccessAdvancedReports =
    profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';
  const { canView: canAccessQualificacao } = useWhatsappAccess();

  const gestaoItems: NavItem[] = [
    { id: 'reports', label: 'Painel Operacional', icon: BarChart3 },
    ...(canAccessAdvancedReports
      ? [{ id: 'advanced-reports', label: 'Relatórios Estratégicos', icon: TrendingUp }]
      : []),
    { id: 'students', label: 'Escolas', icon: Building2 },
    { id: 'appointments', label: 'Reuniões', icon: Calendar },
    ...(canAccessQualificacao
      ? [{ id: 'qualificacao', label: 'Leads (Em Breve)', icon: MessageCircle }]
      : []),
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
        const slug = userUnit?.slug;

        setInscricaoLink(getRegistrationLinkForUnit(slug, isCentral));
      } catch {
        setInscricaoLink('/inscricao');
      }
    };

    computeInscricaoLink();
  }, [profile?.unit_id]);

  const renderNavItem = (item: NavItem) => {
    const isActive = activeTab === item.id;

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          isActive={isActive}
          size="default"
          onClick={() => handleNavClick(item.id)}
          tooltip={isMobile ? undefined : item.label}
          className={menuButtonClass}
        >
          {isActive && (
            <span
              className="absolute left-0 top-0 h-full w-1 rounded-r bg-white/50 group-data-[collapsible=icon]:hidden"
              aria-hidden
            />
          )}
          <span className={navIconBoxClass}>
            <item.icon className="h-3.5 w-3.5 shrink-0 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderNavGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;

    return (
      <SidebarGroup className="px-2 py-0 group-data-[collapsible=icon]:px-1">
        <div className={cn(sectionCardClass, 'group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center')}>
          <SidebarGroupLabel className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-white/45 group-data-[collapsible=icon]:hidden">
            {label}
          </SidebarGroupLabel>
          <SidebarGroupContent className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-0.5">
              {items.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </div>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[#132856] [&_[data-sidebar=sidebar]]:bg-[#1b3472]"
    >
      <SidebarHeader className="p-2 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-1.5 group-data-[collapsible=icon]:pt-2">
        <div
          className={cn(
            sectionCardClass,
            'p-2',
            'group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:ring-0'
          )}
        >
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-sm ring-1 ring-white/20 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
              <img
                src="/logo_apogeu_nobg.png"
                alt="Apogeu"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-bold leading-tight text-white">APOGEU</p>
              <p className="truncate text-[11px] text-white/60">CRM Interno</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="hidden h-7 w-7 shrink-0 rounded-md text-white/70 hover:bg-white/10 hover:text-white md:flex group-data-[collapsible=icon]:md:hidden"
              title={state === 'expanded' ? 'Recolher menu' : 'Expandir menu'}
            >
              {state === 'expanded' ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-2 overflow-hidden px-1 py-1 group-data-[collapsible=icon]:gap-1.5 group-data-[collapsible=icon]:px-0.5">
        {renderNavGroup('Gestão', gestaoItems)}
        {renderNavGroup('Sistema', sistemaItems)}

        <SidebarGroup className="px-2 py-0 group-data-[collapsible=icon]:hidden">
          <div className={sectionCardClass}>
            <SidebarGroupContent>
              <a
                href={inscricaoLink}
                onClick={closeMobileMenu}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#ffac1a] px-2 py-2 text-xs font-semibold text-white shadow-md ring-1 ring-[#ffac1a]/30 transition-all hover:bg-[#e89b0f] hover:shadow-lg"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Nova Escola</span>
              </a>
            </SidebarGroupContent>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-2">
        <div
          className={cn(
            sectionCardClass,
            'space-y-1.5',
            'group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:space-y-0.5'
          )}
        >
          <div className="rounded-lg bg-white/[0.06] px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-medium text-white">{profile?.name}</p>
            <p className="truncate text-[10px] capitalize text-white/55">{profile?.profile}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            title="Sair"
            className={footerActionClass}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:bg-transparent">
              <LogOut className="h-3.5 w-3.5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
            </span>
            <span className="group-data-[collapsible=icon]:hidden">Sair</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              footerActionClass,
              'hidden text-white/70 md:group-data-[collapsible=icon]:flex'
            )}
            title="Expandir menu"
          >
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      </SidebarFooter>
      {!isMobile && <SidebarRail className="hover:after:bg-[#ffac1a]/50" />}
    </Sidebar>
  );
}
