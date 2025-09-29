import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeInteractionComment, sanitizeInput } from '@/utils/sanitization';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, User, Phone, Mail, MapPin, GraduationCap, Percent, CreditCard, Book } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { GradeEditor } from '@/components/GradeEditor';
import { MaterialDidaticoCalculator } from '@/components/ui/MaterialDidaticoCalculator';
import { MonthlyFeeCalculator } from '@/components/ui/MonthlyFeeCalculator';

type Student = Tables<'students'> & {
  classes: Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  };
};

interface StudentDialogProps {
  student: Student;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const StudentDialog = ({ student, open, onClose, onUpdate }: StudentDialogProps) => {
  const { profile } = useAuth();
  const [comments, setComments] = useState('');
  const [newStatus, setNewStatus] = useState<Enums<'student_status'>>(student.status);
  const [dropoutReason, setDropoutReason] = useState<Enums<'dropout_reason'> | ''>('');
  const [dropoutComment, setDropoutComment] = useState<string>('');
  const [interactions, setInteractions] = useState<Tables<'student_interactions'>[]>([]);
  const [hasHadInterview, setHasHadInterview] = useState<boolean>(false);

  const canUpdateToMatriculado = profile?.profile === 'admin';
  
  useEffect(() => {
    if (open) {
      fetchInteractions();
    }
  }, [open, student.id]);

  const fetchInteractions = async () => {
    const { data } = await supabase
      .from('student_interactions')
      .select(`
        *,
        profiles(name)
      `)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (data) {
      setInteractions(data);
      
      // Verificar se o aluno teve entrevista baseado nas interações
      const hasAttendimentoInteraction = data.some(
        interaction => interaction.interaction_type === 'atendimento'
      );
      setHasHadInterview(hasAttendimentoInteraction);
    }
  };

  const handleAddInteraction = async () => {
    if (!comments.trim()) {
      toast.error('Adicione um comentário');
      return;
    }

    // Sanitizar o comentário antes de salvar
    const sanitizedComment = sanitizeInput(comments.trim());

    try {
      const { error } = await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: profile?.id,
          interaction_type: 'comentario',
          comments: sanitizedComment
        });

      if (error) throw error;

      toast.success('Comentário adicionado com sucesso');
      setComments('');
      fetchInteractions();
    } catch (error) {
      console.error('Error adding interaction:', error);
      toast.error('Erro ao adicionar comentário');
    }
  };

  const handleUpdateStatus = async () => {
    if (newStatus === 'desistente' && !dropoutReason) {
      toast.error('Selecione o motivo da desistência');
      return;
    }

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'desistente') {
        updateData.dropout_reason = dropoutReason;
        // Adicionar comentário se for motivos financeiros e houver texto
        if (dropoutReason === 'motivos_financeiros' && dropoutComment.trim()) {
          updateData.dropout_comment = dropoutComment.trim();
        }
      }

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id);

      if (error) throw error;

      // Add interaction
      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: profile?.id,
          interaction_type: 'mudanca_status',
          comments: `Status alterado para: ${newStatus}${newStatus === 'desistente' ? ` (Motivo: ${dropoutReason}${dropoutReason === 'motivos_financeiros' && dropoutComment.trim() ? ` - ${dropoutComment.trim()}` : ''})` : ''}`
        });

      toast.success('Status atualizado com sucesso');
      onUpdate();
      fetchInteractions();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: string) => {
      const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "purple" | "warning" | "ausente" | "cadastro_invalido" | "processo_anos_anteriores" } } = {
        'nao_confirmado': { label: 'Não Confirmado', variant: 'outline' },
        'confirmado': { label: 'Confirmado', variant: 'secondary' },
        'cadastro_invalido': { label: 'Cadastro Inválido', variant: 'cadastro_invalido' },
        'matriculado': { label: 'Matriculado', variant: 'success' },
        'desistente': { label: 'Desistente', variant: 'destructive' },
        'nenhum_agendamento': { label: 'Nenhum Agendamento', variant: 'outline' },
        'atendimento_agendado': { label: 'Atendimento Agendado', variant: 'secondary' },
        'faltou_ao_atendimento': { label: 'Faltou ao Atendimento', variant: 'purple' },
        'atendimento_recentemente': { label: 'Atendimento Recentemente', variant: 'default' },
        'atendimento_ha_mais_de_uma_semana': { label: 'Atendimento há mais de uma semana', variant: 'warning' },
        'ausente': { label: 'Ausente', variant: 'ausente' },
        'processo_anos_anteriores': { label: 'Processo Anos Anteriores', variant: 'processo_anos_anteriores' }
      };

      const config = statusMap[status] || { label: status, variant: 'outline' as const };
      return <Badge variant={config.variant}>{config.label}</Badge>;
    };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Ficha do Aluno - {student.student_name}</span>
          </DialogTitle>
          <DialogDescription>
            Código: {student.code} | Status: {getStatusBadge(student.status)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student Information */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Dados Pessoais</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium">Nome do Aluno:</span>
                    <p>{student.student_name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Responsável:</span>
                    <p>{student.responsible_name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Data de Nascimento:</span>
                    <p>{formatDateForDisplay(student.birth_date)}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Phone className="h-3 w-3" />
                    <span className="font-medium">Telefone:</span>
                    <p>{student.phone}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Mail className="h-3 w-3" />
                    <span className="font-medium">Email:</span>
                    <p>{student.email}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-3 w-3" />
                    <span className="font-medium">Cidade:</span>
                    <p>{student.city}</p>
                  </div>
                  <div>
                    <span className="font-medium">Bairro:</span>
                    <p>{student.neighborhood}</p>
                  </div>
                  <div>
                    <span className="font-medium">Escola de Origem:</span>
                    <p>{student.origin_school}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GraduationCap className="h-4 w-4" />
                  <span>Dados Acadêmicos</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium">Série:</span>
                    <p>{student.classes.series.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Unidade:</span>
                    <p>{student.classes.units.name}</p>
                  </div>
                  <div className="col-span-2">
                    <GradeEditor student={student} onUpdate={onUpdate} variant="inline" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <Percent className="h-3 w-3" />
                    <span className="font-medium">Desconto:</span>
                    <p>{student.discount_percentage !== null ? `${student.discount_percentage}%` : '-'}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">Data da Inscrição:</span>
                    <p>{formatDateForDisplay(student.created_at.split('T')[0])}</p>
                  </div>
                  {student.exam_date && (
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium">Data da Prova:</span>
                      <p>{formatDateForDisplay(student.exam_date)}</p>
                    </div>
                  )}
                  {student.interview_date && (
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium">Data da Entrevista:</span>
                      <p>{formatDateForDisplay(student.interview_date)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financial Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Percent className="h-4 w-4" />
                  <span>Dados Financeiros</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Monthly Fee Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Mensalidade</span>
                  </div>
                  <MonthlyFeeCalculator
                    originalFee={student.classes.monthly_fee || 0}
                    discountPercentage={student.discount_percentage || 0}
                    hasHadInterview={hasHadInterview}
                  />
                </div>

                {/* Material Didático Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <Book className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-purple-900">Material Didático</span>
                  </div>
                  <MaterialDidaticoCalculator
                    materialAnual={student.classes.material_didatico_anual || 0}
                    materialMensal={student.classes.material_didatico_mes || 0}
                    discountMaterial={student.discount_material || 0}
                    hasHadInterview={hasHadInterview}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Status Update */}
            <Card>
              <CardHeader>
                <CardTitle>Atualizar Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as Enums<'student_status'>)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom">
                      <SelectItem value="nao_confirmado">Não Confirmado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="cadastro_invalido">Cadastro Inválido</SelectItem>
                      <SelectItem value="nenhum_agendamento">Nenhum Agendamento</SelectItem>
                      <SelectItem value="atendimento_agendado">Atendimento Agendado</SelectItem>
                      <SelectItem value="faltou_ao_atendimento">Faltou ao Atendimento</SelectItem>
                      <SelectItem value="desistente">Desistente</SelectItem>
                      {canUpdateToMatriculado && (
                        <SelectItem value="matriculado">Matriculado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {newStatus === 'desistente' && (
                  <div>
                    <Select value={dropoutReason} onValueChange={(value) => {
                      setDropoutReason(value as Enums<'dropout_reason'>);
                      // Limpar comentário se mudar de motivos financeiros
                      if (value !== 'motivos_financeiros') {
                        setDropoutComment('');
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent side="bottom">
                        <SelectItem value="impossibilidade_contato">Impossibilidade de contato</SelectItem>
                        <SelectItem value="mudanca_de_endereco">Mudança de Endereço</SelectItem>
                        <SelectItem value="matriculou_outra_escola">Matriculou em Outra Escola</SelectItem>
                        <SelectItem value="motivos_financeiros">Motivos Financeiros</SelectItem>
                        <SelectItem value="falta_vaga">Falta de Vaga</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Campo de texto para motivos financeiros */}
                    {dropoutReason === 'motivos_financeiros' && (
                      <div className="mt-3">
                        <Label htmlFor="dropout-comment">Detalhe os motivos financeiros (opcional)</Label>
                        <Textarea
                          id="dropout-comment"
                          value={dropoutComment}
                          onChange={(e) => setDropoutComment(e.target.value)}
                          placeholder="Ex: Dificuldades financeiras, perda de emprego, etc."
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  onClick={handleUpdateStatus}
                  className="w-full"
                  disabled={newStatus === student.status}
                >
                  Atualizar Status
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Interactions */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Comentário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Adicione um comentário sobre o aluno..."
                  rows={3}
                />
                <Button 
                  onClick={handleAddInteraction}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  Adicionar Comentário
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Interações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {interactions.length > 0 ? (
                    interactions.map((interaction) => (
                      <div key={interaction.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {(interaction as any).profiles?.name || 'Sistema'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(interaction.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p 
                          className="text-sm text-gray-700"
                          dangerouslySetInnerHTML={{ 
                            __html: sanitizeInteractionComment(interaction.comments || '') 
                          }}
                        />
                        <Badge variant="outline" className="mt-1 text-xs">
                          {interaction.interaction_type}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center">Nenhuma interação registrada</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
