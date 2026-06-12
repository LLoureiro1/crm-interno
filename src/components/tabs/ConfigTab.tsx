
import { useRef, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserManagement } from '@/components/management/UserManagement';
import { UnitManagement } from '@/components/management/UnitManagement';
import { ClassManagement } from '@/components/management/ClassManagement';
import { InterviewerAvailability } from '@/components/management/InterviewerAvailability';
import { GradeUpload } from '@/components/management/GradeUpload';
import { ExamDateManagement } from '@/components/management/ExamDateManagement';
import { StudentImport } from '@/components/management/StudentImport';
import { EnrollmentImport } from '@/components/management/EnrollmentImport';
import { RegistrationSourceManagement } from '@/components/management/RegistrationSourceManagement';
import { EmailAutomationManagement } from '@/components/management/EmailAutomationManagement';
import { GoalManagement } from '@/components/management/GoalManagement';
import ContactLists from '@/pages/ContactLists';
import { cn } from '@/lib/utils';

const CONFIG_SECTION_TABS = [
  { value: 'users', label: 'Usuários' },
  { value: 'units', label: 'Unidades' },
  { value: 'classes', label: 'Turmas' },
  { value: 'exam-dates', label: 'Datas de Provas' },
  { value: 'availability', label: 'Disponibilidade' },
  { value: 'grades', label: 'Notas' },
  { value: 'sources', label: 'Origens' },
  { value: 'import', label: 'Importação' },
  { value: 'enrollment', label: 'Matrículas' },
  { value: 'contact-lists', label: 'Listas de Contato' },
  { value: 'emails', label: 'E-mails' },
  { value: 'goals', label: 'Metas' },
] as const;

type ConfigSection = (typeof CONFIG_SECTION_TABS)[number]['value'];

const tabTriggerClassName = cn(
  'rounded-none border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-500 shadow-none sm:px-4 sm:py-2.5',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none'
);

const configCardClassName = 'min-w-0 overflow-hidden';

export const ConfigTab = () => {
  const isMounted = useRef<boolean>(true);
  const [active, setActive] = useState<ConfigSection>('users');

  useEffect(() => {
    isMounted.current = true;

    const handleDOMError = (event: ErrorEvent) => {
      if (event.message.includes('removeChild') || event.message.includes('Node')) {
        console.warn('Erro de DOM capturado e tratado em ConfigTab:', event.message);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('error', handleDOMError);

    return () => {
      isMounted.current = false;
      window.removeEventListener('error', handleDOMError);
    };
  }, []);

  return (
    <div className="relative -mt-2 min-w-0 w-full max-w-none md:-mt-4 lg:-mt-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
          <Settings className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">Configurações</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários, unidades, turmas e configurações do sistema
          </p>
        </div>
      </div>

      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as ConfigSection)}
        className="min-w-0 space-y-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-0 rounded-none border-b border-gray-200 bg-transparent p-0">
          {CONFIG_SECTION_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={tabTriggerClassName}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>Adicione e gerencie usuários do sistema</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Gerenciamento de Unidades</CardTitle>
              <CardDescription>Cadastre e gerencie as unidades da escola</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <UnitManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Gerenciamento de Turmas</CardTitle>
              <CardDescription>Configure turmas, séries e mensalidades</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <ClassManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exam-dates" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Datas de Provas</CardTitle>
              <CardDescription>Configure as datas, horários e unidades das provas</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <ExamDateManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Disponibilidade de Entrevistadores</CardTitle>
              <CardDescription>Configure a disponibilidade dos entrevistadores</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <InterviewerAvailability />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Upload de Notas</CardTitle>
              <CardDescription>Faça upload das notas dos alunos via planilha</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <GradeUpload />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Origens de Inscrição</CardTitle>
              <CardDescription>Configure as opções de origem das inscrições por unidade</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <RegistrationSourceManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-0 min-w-0">
          <StudentImport />
        </TabsContent>

        <TabsContent value="enrollment" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Importação de Matrículas</CardTitle>
              <CardDescription>Importe dados de alunos matriculados no sistema ERP</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <EnrollmentImport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact-lists" className="mt-0 min-w-0">
          <ContactLists />
        </TabsContent>

        <TabsContent value="emails" className="mt-0 min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Automação de E-mails</CardTitle>
              <CardDescription>
                Configure webhook do Google Apps Script, templates HTML e acompanhe a fila de envios
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <EmailAutomationManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="mt-0 min-w-0">
          <div className={configCardClassName}>
            <GoalManagement />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
