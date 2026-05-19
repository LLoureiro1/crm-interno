import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserCheck } from 'lucide-react';
import { StudentsTab } from './StudentsTab';
import { AssignedContactsTab } from './AssignedContactsTab';

export const StudentsMainTab = () => {
  const [active, setActive] = useState<'list' | 'assigned'>('list');

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <Tabs value={active} onValueChange={(v) => setActive(v as 'list' | 'assigned')} className="min-w-0 space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 bg-white p-1 gap-1">
          <TabsTrigger
            value="list"
            className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">Lista de Inscritos</span>
          </TabsTrigger>
          <TabsTrigger
            value="assigned"
            className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">Minhas Listas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <StudentsTab />
        </TabsContent>
        <TabsContent value="assigned" className="min-w-0 space-y-4">
          <AssignedContactsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsMainTab;