
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportsTab } from './tabs/ReportsTab';
import { StudentsTab } from './tabs/StudentsTab';
import { AppointmentsTab } from './tabs/AppointmentsTab';
import { ConfigTab } from './tabs/ConfigTab';
import { AdvancedReportsTab } from './tabs/AdvancedReportsTab';
import { BarChart3, Users, Calendar, Settings, TrendingUp, UserPlus } from 'lucide-react';

export const Dashboard = () => {
  const { profile } = useAuth();

  const canAccessAdvancedReports = profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Bem-vindo ao Laurel Escolar</p>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
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
          <ReportsTab />
        </TabsContent>

        {canAccessAdvancedReports && (
          <TabsContent value="advanced-reports" className="space-y-4">
            <AdvancedReportsTab />
          </TabsContent>
        )}

        <TabsContent value="students" className="space-y-4">
          <StudentsTab />
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <AppointmentsTab />
        </TabsContent>

        {canAccessConfig && (
          <TabsContent value="config" className="space-y-4">
            <ConfigTab />
          </TabsContent>
        )}
      </Tabs>
      
      {/* Botão de Inscrição na parte inferior */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex justify-center">
          <a 
            href="/inscricao"
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
