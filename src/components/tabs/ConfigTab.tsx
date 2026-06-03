
import { useRef, useEffect } from 'react';
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

const tabTriggerClassName =
  'h-auto min-h-9 whitespace-normal px-2 py-2 text-center text-xs leading-snug sm:min-h-10 sm:text-sm';

const configCardClassName = 'min-w-0 overflow-hidden';

export const ConfigTab = () => {
  const isMounted = useRef<boolean>(true);

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
    <div className="min-w-0 w-full max-w-full space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Configurações</h2>
        <p className="text-sm text-gray-600 sm:text-base">
          Gerencie usuários, unidades, turmas e configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="users" className="min-w-0 space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-white p-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {CONFIG_SECTION_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={tabTriggerClassName}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>
                Adicione e gerencie usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Gerenciamento de Unidades</CardTitle>
              <CardDescription>
                Cadastre e gerencie as unidades da escola
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <UnitManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Gerenciamento de Turmas</CardTitle>
              <CardDescription>
                Configure turmas, séries e mensalidades
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <ClassManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exam-dates" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Datas de Provas</CardTitle>
              <CardDescription>
                Configure as datas, horários e unidades das provas
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <ExamDateManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Disponibilidade de Entrevistadores</CardTitle>
              <CardDescription>
                Configure a disponibilidade dos entrevistadores
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <InterviewerAvailability />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Upload de Notas</CardTitle>
              <CardDescription>
                Faça upload das notas dos alunos via planilha
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <GradeUpload />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Origens de Inscrição</CardTitle>
              <CardDescription>
                Configure as opções de origem das inscrições por unidade
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <RegistrationSourceManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="min-w-0">
          <StudentImport />
        </TabsContent>

        <TabsContent value="enrollment" className="min-w-0">
          <Card className={configCardClassName}>
            <CardHeader>
              <CardTitle>Importação de Matrículas</CardTitle>
              <CardDescription>
                Importe dados de alunos matriculados no sistema ERP
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <EnrollmentImport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact-lists" className="min-w-0">
          <ContactLists />
        </TabsContent>

        <TabsContent value="emails" className="min-w-0">
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

        <TabsContent value="goals" className="min-w-0">
          <div className={configCardClassName}>
            <GoalManagement />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
