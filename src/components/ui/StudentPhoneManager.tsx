import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Phone, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPhone } from '@/utils/registrationFormatters';
import type { Tables } from '@/integrations/supabase/types';

type StudentPhone = Tables<'student_phones'>;
type Student = Tables<'students'>;

interface StudentPhoneManagerProps {
  studentId: string;
  disabled?: boolean;
}

export const StudentPhoneManager = ({ studentId, disabled = false }: StudentPhoneManagerProps) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [additionalPhones, setAdditionalPhones] = useState<StudentPhone[]>([]);
  const [editingPrimaryPhone, setEditingPrimaryPhone] = useState('');
  const [editingAdditionalPhones, setEditingAdditionalPhones] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudentAndPhones();
  }, [studentId]);

  const fetchStudentAndPhones = async () => {
    try {
      // Buscar dados do aluno
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('phone')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // Buscar telefones adicionais
      const { data: phonesData, error: phonesError } = await supabase
        .from('student_phones')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true });

      if (phonesError) throw phonesError;
      setAdditionalPhones(phonesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados do aluno:', error);
      toast.error('Erro ao carregar telefones do aluno');
    }
  };

  const startEditing = () => {
    setEditingPrimaryPhone(student?.phone || '');
    setEditingAdditionalPhones(additionalPhones.map(p => p.phone_number));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditingPrimaryPhone('');
    setEditingAdditionalPhones([]);
    setIsEditing(false);
  };

  const addPhone = () => {
    setEditingAdditionalPhones([...editingAdditionalPhones, '']);
  };

  const removePhone = (index: number) => {
    const updatedPhones = editingAdditionalPhones.filter((_, i) => i !== index);
    setEditingAdditionalPhones(updatedPhones);
  };

  const updateAdditionalPhone = (index: number, value: string) => {
    const updatedPhones = editingAdditionalPhones.map((phone, i) => 
      i === index ? formatPhone(value) : phone
    );
    setEditingAdditionalPhones(updatedPhones);
  };

  const savePhones = async () => {
    try {
      setLoading(true);

      // Validar telefone principal
      if (!editingPrimaryPhone) {
        toast.error('Telefone principal é obrigatório');
        return;
      }
      const primaryPhoneDigits = editingPrimaryPhone.replace(/\D/g, '');
      if (primaryPhoneDigits.length !== 10 && primaryPhoneDigits.length !== 11) {
        toast.error('Telefone principal deve ter 10 ou 11 dígitos com DDD');
        return;
      }

      // Validar telefones adicionais
      const validAdditionalPhones = editingAdditionalPhones.filter(phone => {
        if (!phone) return false;
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
          toast.error('Todos os telefones adicionais devem ter 10 ou 11 dígitos com DDD');
          return false;
        }
        return true;
      });

      // Atualizar telefone principal na tabela students
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({ phone: editingPrimaryPhone })
        .eq('id', studentId);

      if (studentUpdateError) throw studentUpdateError;

      // Deletar todos os telefones adicionais existentes
      const { error: deleteError } = await supabase
        .from('student_phones')
        .delete()
        .eq('student_id', studentId);

      if (deleteError) throw deleteError;

      // Inserir novos telefones adicionais
      if (validAdditionalPhones.length > 0) {
        const phoneInserts = validAdditionalPhones.map(phone => ({
          student_id: studentId,
          phone_number: phone
        }));

        const { error: insertError } = await supabase
          .from('student_phones')
          .insert(phoneInserts);

        if (insertError) throw insertError;
      }

      toast.success('Telefones atualizados com sucesso!');
      await fetchStudentAndPhones();
      setIsEditing(false);
      setEditingPrimaryPhone('');
      setEditingAdditionalPhones([]);
    } catch (error) {
      console.error('Erro ao salvar telefones:', error);
      toast.error('Erro ao salvar telefones');
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold text-gray-800">
            <Phone className="h-4 w-4 inline mr-2" />
            Editar Telefones
          </Label>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPhone}
              disabled={disabled || loading}
              className="flex items-center space-x-1"
            >
              <Plus className="h-3 w-3" />
              <span>Adicionar</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={savePhones}
              disabled={disabled || loading}
              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
            >
              <Save className="h-3 w-3" />
              <span>Salvar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              disabled={loading}
              className="flex items-center space-x-1"
            >
              <X className="h-3 w-3" />
              <span>Cancelar</span>
            </Button>
          </div>
        </div>

        {/* Telefone Principal */}
        <div className="p-4 border rounded-lg bg-blue-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label htmlFor="primary-phone-edit">
                Telefone Principal *
              </Label>
              <Input
                id="primary-phone-edit"
                value={editingPrimaryPhone}
                onChange={(e) => setEditingPrimaryPhone(formatPhone(e.target.value))}
                placeholder="(XX) XXXXX-XXXX"
                maxLength={15}
                disabled={loading}
                required
              />
            </div>
            <div className="flex items-center">
              <div className="text-xs text-blue-600 font-medium">
                ✓ Telefone principal
              </div>
            </div>
          </div>
        </div>

        {/* Telefones Adicionais */}
        {editingAdditionalPhones.map((phone, index) => (
          <div key={index} className="p-4 border rounded-lg bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor={`additional-phone-edit-${index}`}>
                  Telefone Adicional {index + 1}
                </Label>
                <Input
                  id={`additional-phone-edit-${index}`}
                  value={phone}
                  onChange={(e) => updateAdditionalPhone(index, e.target.value)}
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={15}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removePhone(index)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        
        {editingAdditionalPhones.length === 0 && (
          <div className="text-center py-2 text-gray-500 text-sm">
            <p>Clique em "Adicionar" para incluir telefones extras</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold text-gray-800">
          <Phone className="h-4 w-4 inline mr-2" />
          Telefones
        </Label>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startEditing}
            className="flex items-center space-x-1"
          >
            <Phone className="h-3 w-3" />
            <span>Editar</span>
          </Button>
        )}
      </div>

      {/* Telefone Principal */}
      {student?.phone && (
        <div className="p-3 border rounded-lg bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Phone className="h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">{student.phone}</p>
                <div className="text-xs text-blue-600 font-medium">
                  Telefone principal
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Telefones Adicionais */}
      {additionalPhones.length > 0 && additionalPhones.map((phone, index) => (
        <div key={phone.id} className="p-3 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Phone className="h-4 w-4 text-gray-500" />
              <div>
                <p className="font-medium">{phone.phone_number}</p>
                <div className="text-xs text-gray-600">
                  Telefone adicional {index + 1}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {!student?.phone && additionalPhones.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum telefone cadastrado</p>
        </div>
      )}
    </div>
  );
};
