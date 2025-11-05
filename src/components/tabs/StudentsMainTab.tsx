import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Users, UserCheck } from 'lucide-react';
import { StudentsTab } from './StudentsTab';
import { AssignedContactsTab } from './AssignedContactsTab';

export const StudentsMainTab = () => {
  const [active, setActive] = useState<'list' | 'assigned'>('list');

  return (
    <div className="space-y-4">
      <Tabs value={active} onValueChange={(v) => setActive(v as 'list' | 'assigned')} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-auto min-w-full bg-white p-1 gap-1 md:grid md:grid-cols-2">
            <TabsTrigger value="list" className="flex items-center space-x-2 min-w-max px-3 py-2 text-sm">
              <Users className="h-4 w-4" />
              <span>Lista de Inscritos</span>
            </TabsTrigger>
            <TabsTrigger value="assigned" className="flex items-center space-x-2 min-w-max px-3 py-2 text-sm">
              <UserCheck className="h-4 w-4" />
              <span>Meus Designados</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="space-y-4">
          <StudentsTab />
        </TabsContent>
        <TabsContent value="assigned" className="space-y-4">
          <AssignedContactsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsMainTab;