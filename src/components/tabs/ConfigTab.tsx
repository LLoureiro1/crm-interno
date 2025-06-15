
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/management/UserManagement';
import { UnitManagement } from '@/components/management/UnitManagement';
import { ClassManagement } from '@/components/management/ClassManagement';
import { GradeUpload } from '@/components/management/GradeUpload';
import { InterviewerAvailability } from '@/components/management/InterviewerAvailability';

export const ConfigTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Configurações do Sistema</h2>
        <p className="text-gray-600">Gerencie usuários, unidades, turmas e outras configurações</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Gestão de Usuários</TabsTrigger>
          <TabsTrigger value="units">Gestão de Unidades</TabsTrigger>
          <TabsTrigger value="classes">Gestão de Turmas</TabsTrigger>
          <TabsTrigger value="grades">Upload de Notas</TabsTrigger>
          <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="units">
          <UnitManagement />
        </TabsContent>

        <TabsContent value="classes">
          <ClassManagement />
        </TabsContent>

        <TabsContent value="grades">
          <GradeUpload />
        </TabsContent>

        <TabsContent value="availability">
          <InterviewerAvailability />
        </TabsContent>
      </Tabs>
    </div>
  );
};
