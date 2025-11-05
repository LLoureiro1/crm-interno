
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportsTab } from './tabs/ReportsTab';
import { StudentsMainTab } from './tabs/StudentsMainTab';
import { AppointmentsTab } from './tabs/AppointmentsTab';
import { ConfigTab } from './tabs/ConfigTab';
import { AdvancedReportsTab } from './tabs/AdvancedReportsTab';
import { BarChart3, Users, Calendar, Settings, TrendingUp, UserPlus } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';
import { supabase } from '@/integrations/supabase/client';

export const Dashboard = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('reports');
  const [inscricaoLink, setInscricaoLink] = useState('/inscricao');

  const canAccessAdvancedReports = profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';

  // Restaurar aba ativa se veio de uma navegação
  useEffect(() => {
    const navigationState = location.state as { activeTab?: string };
    
    if (navigationState?.activeTab) {
      setActiveTab(navigationState.activeTab);
    }
  }, [location.state]);

  // Montar link de "Nova Inscrição" com base na unidade do usuário
  useEffect(() => {
    const computeInscricaoLink = async () => {
      try {
        if (profile?.unit_id) {
          const { data: userUnit, error } = await supabase
            .from('units')
            .select('id, name, slug')
            .eq('id', profile.unit_id)
            .maybeSingle() as any;

          if (error) {
            console.warn('Erro ao buscar unidade para montar link de inscrição:', error);
            setInscricaoLink('/inscricao');
            return;
          }

          const unitName = (userUnit?.name || '').toLowerCase();
          const isCentral = unitName === 'central';
          const slug = userUnit?.slug as string | null;

          if (!isCentral && slug) {
            setInscricaoLink(`/inscricao/${slug}`);
          } else {
            setInscricaoLink('/inscricao');
          }
        } else {
          setInscricaoLink('/inscricao');
        }
      } catch (err) {
        console.warn('Falha ao montar link de inscrição:', err);
        setInscricaoLink('/inscricao');
      }
    };

    computeInscricaoLink();
  }, [profile?.unit_id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Bem-vindo ao Laurel Escolar</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-auto min-w-full bg-white p-1 gap-1 md:grid md:grid-cols-5">
            <TabsTrigger value="reports" className="flex items-center space-x-2 min-w-max px-3 py-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              <span>Relatórios</span>
            </TabsTrigger>
            {canAccessAdvancedReports && (
              <TabsTrigger value="advanced-reports" className="flex items-center space-x-2 min-w-max px-3 py-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                <span>Relatórios Avançados</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="students" className="flex items-center space-x-2 min-w-max px-3 py-2 text-sm">
              <Users className="h-4 w-4" />
              <span>Inscritos</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex items-center space-x-2 min-w-max px-3 py-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span>Agendamentos</span>
            </TabsTrigger>
            {canAccessConfig && (
              <TabsTrigger value="config" className="flex items-center space-x-2 min-w-max px-3 py-2 text-sm">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="reports" className="space-y-4">
          <ErrorBoundary>
            <ReportsTab />
          </ErrorBoundary>
        </TabsContent>

        {canAccessAdvancedReports && (
          <TabsContent value="advanced-reports" className="space-y-4">
            <ErrorBoundary>
              <AdvancedReportsTab />
            </ErrorBoundary>
          </TabsContent>
        )}

        <TabsContent value="students" className="space-y-4">
          <ErrorBoundary>
            <StudentsMainTab />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <ErrorBoundary>
            <AppointmentsTab />
          </ErrorBoundary>
        </TabsContent>

        {canAccessConfig && (
          <TabsContent value="config" className="space-y-4">
            <ErrorBoundary>
              <ConfigTab />
            </ErrorBoundary>
          </TabsContent>
        )}
      </Tabs>
      
      {/* Botão de Inscrição na parte inferior */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex justify-center">
          <a 
            href={inscricaoLink}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer inline-block"
          >
            <UserPlus className="h-5 w-5" />
            <span>Nova Inscrição</span>
          </a>
        </div>
      </div>
    </div>
  );
};
