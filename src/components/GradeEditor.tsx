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
  const [portugueseGrade, setPortugueseGrade] = useState<string>(student.portuguese_grade?.toString() || '');
  const [mathGrade, setMathGrade] = useState<string>(student.math_grade?.toString() || '');

  const validateGrade = (value: string): boolean => {
    if (value === '') return true; // Permitir campo vazio
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 10;
  };

  const handleSave = async () => {
    // Validações
    if (!validateGrade(portugueseGrade)) {
      toast.error('Nota de Português deve estar entre 0 e 10');
      return;
    }
    
    if (!validateGrade(mathGrade)) {
      toast.error('Nota de Matemática deve estar entre 0 e 10');
      return;
    }

    setLoading(true);

    try {
      const updateData: any = {
        portuguese_grade: portugueseGrade === '' ? null : parseFloat(portugueseGrade),
        math_grade: mathGrade === '' ? null : parseFloat(mathGrade)
      };

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id);

      if (error) throw error;

      // Adicionar interação
      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          interaction_type: 'notas_alteradas',
          comments: `Notas atualizadas - Português: ${updateData.portuguese_grade || 'Não informado'}, Matemática: ${updateData.math_grade || 'Não informado'}`
        });

      toast.success('Notas atualizadas com sucesso');
      setIsEditing(false);
      onUpdate();
      
      if (variant === 'dialog' && onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error updating grades:', error);
      toast.error('Erro ao atualizar notas');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPortugueseGrade(student.portuguese_grade?.toString() || '');
    setMathGrade(student.math_grade?.toString() || '');
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setPortugueseGrade(student.portuguese_grade?.toString() || '');
    setMathGrade(student.math_grade?.toString() || '');
    setIsEditing(true);
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notas</h3>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="portuguese-grade">Nota Português</Label>
          {isEditing ? (
            <Input
              id="portuguese-grade"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={portugueseGrade}
              onChange={(e) => setPortugueseGrade(e.target.value)}
              placeholder="0.0 - 10.0"
              className={!validateGrade(portugueseGrade) ? 'border-red-500' : ''}
            />
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              {student.portuguese_grade !== null ? student.portuguese_grade.toFixed(1) : 'Não informado'}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="math-grade">Nota Matemática</Label>
          {isEditing ? (
            <Input
              id="math-grade"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={mathGrade}
              onChange={(e) => setMathGrade(e.target.value)}
              placeholder="0.0 - 10.0"
              className={!validateGrade(mathGrade) ? 'border-red-500' : ''}
            />
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              {student.math_grade !== null ? student.math_grade.toFixed(1) : 'Não informado'}
            </p>
          )}
        </div>
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
