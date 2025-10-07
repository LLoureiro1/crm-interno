
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserManagement } from '@/components/management/UserManagement';
import { UnitManagement } from '@/components/management/UnitManagement';
import { ClassManagement } from '@/components/management/ClassManagement';
import { InterviewerAvailability } from '@/components/management/InterviewerAvailability';
import { GradeUpload } from '@/components/management/GradeUpload';
import { ExamDateManagement } from '@/components/management/ExamDateManagement';
import { StudentImport } from '@/components/management/StudentImport';
import { RegistrationSourceManagement } from '@/components/management/RegistrationSourceManagement';

export const ConfigTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Configurações</h2>
        <p className="text-gray-600">Gerencie usuários, unidades, turmas e configurações do sistema</p>
      </div>
      
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
          <TabsTrigger value="classes">Turmas</TabsTrigger>
          <TabsTrigger value="exam-dates">Datas de Provas</TabsTrigger>
          <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
          <TabsTrigger value="grades">Notas</TabsTrigger>
          <TabsTrigger value="sources">Origens</TabsTrigger>
          <TabsTrigger value="import">Importação</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
};
