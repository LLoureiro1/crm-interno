import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Edit3, Check, X } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;

interface GradeEditorProps {
  student: Student;
  onUpdate: () => void;
  variant?: 'inline' | 'dialog';
  onClose?: () => void;
}

export const GradeEditor = ({ student, onUpdate, variant = 'inline', onClose }: GradeEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finalGrade, setFinalGrade] = useState<string>(student.final_grade?.toString() || '');

  const validateGrade = (value: string): boolean => {
    if (value === '') return true; // Permitir campo vazio
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 30;
  };

  const handleSave = async () => {
    // Validações
    if (!validateGrade(finalGrade)) {
      toast.error('Nota deve estar entre 0 e 30');
      return;
    }

    setLoading(true);

    try {
      // Verificar se o status deve ser alterado (só acontece se a nota foi inserida)
      const statusesToUpdate = ['nao_confirmado', 'confirmado', 'ausente'];
      const hasGrade = finalGrade !== '';
      const shouldUpdateStatus = statusesToUpdate.includes(student.status) && hasGrade;

      const updateData: any = {
        final_grade: finalGrade === '' ? null : parseFloat(finalGrade)
      };

      // Se deve atualizar o status, adicionar à atualização
      if (shouldUpdateStatus) {
        updateData.status = 'nenhum_agendamento';
      }

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id);

      if (error) throw error;

      // Adicionar interação
      let interactionComment = `Nota unificada atualizada: ${updateData.final_grade || 'Não informado'}`;
      
      if (shouldUpdateStatus) {
        interactionComment += ` | Status alterado automaticamente de '${student.status}' para 'nenhum_agendamento' devido à inserção da nota`;
      }

      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          interaction_type: 'notas_alteradas',
          comments: interactionComment
        });

      const successMessage = shouldUpdateStatus 
        ? 'Nota inserida com sucesso. Status alterado automaticamente para "nenhum_agendamento".'
        : 'Nota atualizada com sucesso';
      
      toast.success(successMessage);
      setIsEditing(false);
      onUpdate();
      
      if (variant === 'dialog' && onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error updating grades:', error);
      toast.error('Erro ao atualizar nota');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFinalGrade(student.final_grade?.toString() || '');
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setFinalGrade(student.final_grade?.toString() || '');
    setIsEditing(true);
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Nota Unificada</h3>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartEdit}
            className="flex items-center space-x-2"
          >
            <Edit3 className="h-4 w-4" />
            <span>Editar</span>
          </Button>
        )}
      </div>

      <div>
        <Label htmlFor="final-grade">Nota (0-30)</Label>
        {isEditing ? (
          <Input
            id="final-grade"
            type="number"
            min="0"
            max="30"
            step="0.5"
            value={finalGrade}
            onChange={(e) => setFinalGrade(e.target.value)}
            placeholder="Insira a nota unificada"
            className={!validateGrade(finalGrade) ? 'border-red-500' : ''}
          />
        ) : (
          <p className="text-sm text-gray-600 mt-1">
            {student.final_grade !== null ? student.final_grade?.toFixed(1) : 'Não informado'}
          </p>
        )}
      </div>

      {isEditing && (
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span>Salvar</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Cancelar</span>
          </Button>
        </div>
      )}
    </div>
  );

  if (variant === 'dialog') {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Notas - {student.student_name}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {content}
      </CardContent>
    </Card>
  );
};
