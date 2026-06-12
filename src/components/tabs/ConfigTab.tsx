
import { useRef, useEffect, useState, type ReactNode } from 'react';
import {
  Settings,
  Users,
  Building2,
  GraduationCap,
  Calendar,
  Clock,
  FileSpreadsheet,
  Share2,
  Upload,
  UserPlus,
  List,
  Mail,
  Target,
  type LucideIcon,
} from 'lucide-react';
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

function ConfigSectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="relative min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="absolute left-0 top-0 h-full w-1.5 bg-primary" />
      <CardHeader className="border-b border-gray-100 pb-3 pl-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary">
          <Icon className="h-5 w-5 shrink-0 text-primary" />
          <span>{title}</span>
        </CardTitle>
        {description && <CardDescription className="mt-1 pl-7">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="min-w-0 pl-5 pt-4">{children}</CardContent>
    </Card>
  );
}

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
          <ConfigSectionCard icon={Users} title="Gerenciamento de Usuários" description="Adicione e gerencie usuários do sistema">
            <UserManagement />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="units" className="mt-0 min-w-0">
          <ConfigSectionCard icon={Building2} title="Gerenciamento de Unidades" description="Cadastre e gerencie as unidades da escola">
            <UnitManagement />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="classes" className="mt-0 min-w-0">
          <ConfigSectionCard icon={GraduationCap} title="Gerenciamento de Turmas" description="Configure turmas, séries e mensalidades">
            <ClassManagement />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="exam-dates" className="mt-0 min-w-0">
          <ConfigSectionCard icon={Calendar} title="Datas de Provas" description="Configure as datas, horários e unidades das provas">
            <ExamDateManagement />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="availability" className="mt-0 min-w-0">
          <ConfigSectionCard icon={Clock} title="Disponibilidade de Entrevistadores" description="Configure a disponibilidade dos entrevistadores">
            <InterviewerAvailability />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="grades" className="mt-0 min-w-0">
          <ConfigSectionCard icon={FileSpreadsheet} title="Upload de Notas" description="Faça upload das notas dos alunos via planilha">
            <GradeUpload />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="sources" className="mt-0 min-w-0">
          <ConfigSectionCard icon={Share2} title="Origens de Inscrição" description="Configure as opções de origem das inscrições por unidade">
            <RegistrationSourceManagement />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="import" className="mt-0 min-w-0">
          <ConfigSectionCard icon={Upload} title="Importação de Alunos" description="Importe candidatos via planilha">
            <StudentImport />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="enrollment" className="mt-0 min-w-0">
          <ConfigSectionCard icon={UserPlus} title="Importação de Matrículas" description="Importe dados de alunos matriculados no sistema ERP">
            <EnrollmentImport />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="contact-lists" className="mt-0 min-w-0">
          <ConfigSectionCard icon={List} title="Listas de Contato" description="Gerencie listas e distribuição de contatos">
            <ContactLists />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="emails" className="mt-0 min-w-0">
          <ConfigSectionCard
            icon={Mail}
            title="Automação de E-mails"
            description="Configure webhook do Google Apps Script, templates HTML e acompanhe a fila de envios"
          >
            <EmailAutomationManagement />
          </ConfigSectionCard>
        </TabsContent>

        <TabsContent value="goals" className="mt-0 min-w-0">
          <ConfigSectionCard icon={Target} title="Metas" description="Configure metas de matrícula por unidade">
            <GoalManagement />
          </ConfigSectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};
