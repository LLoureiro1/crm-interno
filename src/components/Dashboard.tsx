
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportsTab } from './tabs/ReportsTab';
import { StudentsTab } from './tabs/StudentsTab';
import { AppointmentsTab } from './tabs/AppointmentsTab';
import { ConfigTab } from './tabs/ConfigTab';
import { AdvancedReportsTab } from './tabs/AdvancedReportsTab';
import { BarChart3, Users, Calendar, Settings, TrendingUp } from 'lucide-react';

export const Dashboard = () => {
  const { profile } = useAuth();

  const canAccessAdvancedReports = profile?.profile === 'admin' || profile?.profile === 'direcao';
  const canAccessConfig = profile?.profile === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Bem-vindo ao CRM Educacional</p>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-white">
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Relatórios</span>
          </TabsTrigger>
          {canAccessAdvancedReports && (
            <TabsTrigger value="advanced-reports" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Relatórios Avançados</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="students" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Alunos</span>
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Agendamentos</span>
          </TabsTrigger>
          {canAccessConfig && (
            <TabsTrigger value="config" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </TabsTrigger>
          )}
        </TabsList>

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
    </div>
  );
};
