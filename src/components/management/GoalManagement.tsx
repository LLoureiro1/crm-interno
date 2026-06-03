import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Unit = Tables<'units'>;

export const GoalManagement = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar unidades');
      return;
    }

    setUnits(data || []);
    const initialGoals: Record<string, number> = {};
    (data || []).forEach(unit => {
      initialGoals[unit.id] = unit.student_goal || 0;
    });
    setGoals(initialGoals);
  };

  const handleGoalChange = (unitId: string, value: string) => {
    const numValue = parseInt(value, 10);
    setGoals(prev => ({
      ...prev,
      [unitId]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const saveGoal = async (unitId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('units')
        .update({ student_goal: goals[unitId] } as any)
        .eq('id', unitId);

      if (error) throw error;
      toast.success('Meta atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar meta:', error);
      toast.error('Erro ao atualizar meta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metas por Unidade</CardTitle>
        <CardDescription>
          Defina a meta de matrículas esperada para cada unidade. Esta meta é utilizada no dashboard principal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Unidade</TableHead>
                <TableHead className="w-[200px]">Meta de Matrículas</TableHead>
                <TableHead className="w-[120px] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={goals[unit.id] === 0 && !goals[unit.id] && goals[unit.id] !== 0 ? '' : goals[unit.id]}
                      onChange={(e) => handleGoalChange(unit.id, e.target.value)}
                      className="w-full max-w-[150px]"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveGoal(unit.id)}
                      disabled={loading || goals[unit.id] === unit.student_goal}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
