
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ContactLists from '@/pages/ContactLists';
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

export const ConfigTab = () => {
  const isMounted = useRef<boolean>(true);
  const navigate = useNavigate();
  
  // Tratamento defensivo para operações do DOM
  useEffect(() => {
    // Marcar componente como montado
    isMounted.current = true;
    
    // Função para capturar erros de DOM globalmente
    const handleDOMError = (event: ErrorEvent) => {
      if (event.message.includes('removeChild') || event.message.includes('Node')) {
        console.warn('Erro de DOM capturado e tratado em ConfigTab:', event.message);
        event.preventDefault();
        event.stopPropagation();
      }
    };
    
    // Adicionar listener de erro global
    window.addEventListener('error', handleDOMError);
    
    // Limpeza ao desmontar
    return () => {
      isMounted.current = false;
      window.removeEventListener('error', handleDOMError);
    };
  }, []);
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Configurações</h2>
        <p className="text-gray-600">Gerencie usuários, unidades, turmas e configurações do sistema</p>
      </div>
      
      <Tabs defaultValue="users" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-auto min-w-full bg-white p-1 gap-1 md:grid md:grid-cols-5">
            <TabsTrigger value="users" className="min-w-max px-3 py-2 text-sm">Usuários</TabsTrigger>
            <TabsTrigger value="units" className="min-w-max px-3 py-2 text-sm">Unidades</TabsTrigger>
            <TabsTrigger value="classes" className="min-w-max px-3 py-2 text-sm">Turmas</TabsTrigger>
            <TabsTrigger value="exam-dates" className="min-w-max px-3 py-2 text-sm">Datas de Provas</TabsTrigger>
            <TabsTrigger value="availability" className="min-w-max px-3 py-2 text-sm">Disponibilidade</TabsTrigger>
          </TabsList> 
          <TabsList className="inline-flex h-auto min-w-full bg-white p-1 gap-1 md:grid md:grid-cols-5">
            <TabsTrigger value="grades" className="min-w-max px-3 py-2 text-sm">Notas</TabsTrigger>
            <TabsTrigger value="sources" className="min-w-max px-3 py-2 text-sm">Origens</TabsTrigger>
            <TabsTrigger value="import" className="min-w-max px-3 py-2 text-sm">Importação</TabsTrigger>
            <TabsTrigger value="enrollment" className="min-w-max px-3 py-2 text-sm">Matrículas</TabsTrigger>
            <TabsTrigger value="contact-lists" className="min-w-max px-3 py-2 text-sm">Listas de Contato</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>
                Adicione e gerencie usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Unidades</CardTitle>
              <CardDescription>
                Cadastre e gerencie as unidades da escola
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UnitManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Turmas</CardTitle>
              <CardDescription>
                Configure turmas, séries e mensalidades
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClassManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exam-dates">
          <Card>
            <CardHeader>
              <CardTitle>Datas de Provas</CardTitle>
              <CardDescription>
                Configure as datas, horários e unidades das provas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExamDateManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Disponibilidade de Entrevistadores</CardTitle>
              <CardDescription>
                Configure a disponibilidade dos entrevistadores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InterviewerAvailability />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades">
          <Card>
            <CardHeader>
              <CardTitle>Upload de Notas</CardTitle>
              <CardDescription>
                Faça upload das notas dos alunos via planilha
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GradeUpload />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Origens de Inscrição</CardTitle>
              <CardDescription>
                Configure as opções de origem das inscrições por unidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegistrationSourceManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <StudentImport />
        </TabsContent>

        <TabsContent value="enrollment">
          <Card>
            <CardHeader>
              <CardTitle>Importação de Matrículas</CardTitle>
              <CardDescription>
                Importe dados de alunos matriculados no sistema ERP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnrollmentImport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact-lists">
          <ContactLists />
        </TabsContent>
      </Tabs>
    </div>
  );
};
