import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudentsTab } from './StudentsTab';
import { AssignedContactsTab } from './AssignedContactsTab';

export const StudentsMainTab = () => {
  const [active, setActive] = useState<'list' | 'assigned'>('list');

  return (
    <div className="relative -mt-2 min-w-0 w-full max-w-full md:-mt-4 lg:-mt-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">Gestão de Inscritos</h2>
          <p className="text-sm text-muted-foreground">
            Visualize e gerencie todos os candidatos cadastrados
          </p>
        </div>
      </div>

      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as 'list' | 'assigned')}
        className="min-w-0 space-y-4"
      >
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b border-gray-200 bg-transparent p-0">
          <TabsTrigger
            value="list"
            className={cn(
              'flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none'
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>Lista de Inscritos</span>
          </TabsTrigger>
          <TabsTrigger
            value="assigned"
            className={cn(
              'flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none'
            )}
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>Minhas Listas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0 space-y-4">
          <StudentsTab />
        </TabsContent>
        <TabsContent value="assigned" className="mt-0 min-w-0 space-y-4">
          <AssignedContactsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsMainTab;
