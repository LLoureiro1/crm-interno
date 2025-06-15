
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/management/UserManagement';
import { UnitManagement } from '@/components/management/UnitManagement';
import { ClassManagement } from '@/components/management/ClassManagement';
import { GradeUpload } from '@/components/management/GradeUpload';
import { Users, Building, GraduationCap, Upload } from 'lucide-react';

export const ConfigTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Configurações do Sistema</h2>
        <p className="text-gray-600">Gerencie usuários, unidades, turmas e configurações gerais</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center space-x-2">
            <Building className="h-4 w-4" />
            <span>Unidades</span>
          </TabsTrigger>
          <TabsTrigger value="classes" className="flex items-center space-x-2">
            <GraduationCap className="h-4 w-4" />
            <span>Turmas</span>
          </TabsTrigger>
          <TabsTrigger value="grades" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Upload de Notas</span>
          </TabsTrigger>
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
      </Tabs>
    </div>
  );
};
