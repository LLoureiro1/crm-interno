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
import { Calendar, Phone, Mail, MapPin, GraduationCap, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { formatDateForDisplay, dateToLocalString } from '@/utils/dateUtils';
import { ReactivateStudentButton } from '@/components/ui/ReactivateStudentButton';
import { cn } from '@/lib/utils';

const CARD_CLASS = 'overflow-hidden border border-slate-200 border-l-4 border-l-primary shadow-sm';
const CTA_CLASS = 'w-full bg-[#ffac1a] text-white hover:bg-[#e89b0f]';

type Student = Tables<'students'> & {
  classes?: (Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  }) | null;
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
  const [invalidReason, setInvalidReason] = useState<string>('');
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

    if (newStatus === 'cadastro_invalido' && !invalidReason) {
      toast.error('Selecione o motivo do cadastro inválido');
      return;
    }

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'desistente') {
        updateData.dropout_reason = dropoutReason;
        // Adicionar comentário opcional independentemente do motivo
        if (dropoutComment.trim()) {
          updateData.dropout_comment = dropoutComment.trim();
        }
      }

      if (newStatus === 'cadastro_invalido') {
        updateData.invalid_reason = invalidReason;
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
          comments: `Status alterado para: ${newStatus === 'cadastro_invalido' ? 'Cadastro Inválido' : newStatus}${newStatus === 'desistente' ? ` (Motivo: ${dropoutReason}${dropoutComment.trim() ? ` - ${dropoutComment.trim()}` : ''})` : newStatus === 'cadastro_invalido' ? ` (Motivo: ${invalidReason === 'cadastro_duplicado' ? 'Cadastro Duplicado' : invalidReason === 'cadastro_de_teste' ? 'Cadastro de Teste' : invalidReason === 'ja_e_aluno' ? 'Já é aluno' : invalidReason})` : ''}`
        });

      toast.success('Status atualizado com sucesso');
      onUpdate();
      fetchInteractions();
      setDropoutReason('');
      setDropoutComment('');
      setInvalidReason('');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: string, placement: 'header' | 'inline' = 'inline') => {
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

      if (placement === 'header') {
        const headerTone: Record<string, string> = {
          destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
          success: 'border-green-200 bg-green-50 text-green-700',
          warning: 'border-orange-200 bg-orange-50 text-orange-700',
          default: 'border-primary/20 bg-primary/10 text-primary',
          secondary: 'border-blue-200 bg-blue-50 text-blue-700',
          outline: 'border-border bg-muted text-muted-foreground',
        };
        return (
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-transparent',
              headerTone[config.variant] ?? headerTone.outline
            )}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {config.label}
          </Badge>
        );
      }

      return <Badge variant={config.variant}>{config.label}</Badge>;
    };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] gap-0 overflow-y-auto p-0 sm:rounded-lg">
        <DialogHeader className="space-y-2 border-b border-slate-200 px-6 pb-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-primary">
              <Building2 className="h-5 w-5" />
              <span>Ficha da Escola — {student.student_name}</span>
            </DialogTitle>
            {getStatusBadge(student.status, 'header')}
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Código {student.code}{student.inep_code ? ` • INEP: ${student.inep_code}` : ''}{student.city ? ` • ${student.city}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-2">
          {/* Student Information */}
          <div className="space-y-4">
            {/* Student Reactivation */}
            <ReactivateStudentButton 
              student={student} 
              onSuccess={onUpdate}
            />

            <Card className={CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <Building2 className="h-4 w-4" />
                  <span>Dados da Escola</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Nome da Escola</p>
                    <p className="text-sm font-medium text-foreground">{student.student_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Código INEP</p>
                    <p className="text-sm font-medium text-foreground">
                      {student.inep_code || <span className="italic text-muted-foreground">Não informado</span>}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Cidade</p>
                      <p className="text-sm font-medium text-foreground">
                        {student.city || <span className="italic text-muted-foreground">Não informado</span>}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {student.phone || <span className="italic text-muted-foreground">Não informado</span>}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground">
                        {student.email || <span className="italic text-muted-foreground">Não informado</span>}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data do Cadastro</p>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {formatDateForDisplay(dateToLocalString(new Date(student.created_at)))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <GraduationCap className="h-4 w-4" />
                  <span>Alunos por Segmento</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {([
                    { label: 'Infantil', value: student.infantil_count },
                    { label: 'Fund. I (EF1)', value: student.ef1_count },
                    { label: 'Fund. II (EF2)', value: student.ef2_count },
                    { label: 'Ensino Médio', value: student.medio_count },
                  ] as { label: string; value: number | null }[]).map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-muted/40 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-bold text-primary">
                        {value != null ? value.toLocaleString('pt-BR') : <span className="text-sm font-normal italic text-muted-foreground">—</span>}
                      </p>
                    </div>
                  ))}
                  <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center sm:col-span-3">
                    <p className="text-xs font-medium text-primary">Total de Alunos</p>
                    <p className="text-2xl font-bold text-primary">
                      {student.total_students_count != null
                        ? student.total_students_count.toLocaleString('pt-BR')
                        : <span className="text-sm font-normal italic text-muted-foreground">Não informado</span>}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Update */}
            <Card className={CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-primary">Atualizar Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="status-select">Novo Status</Label>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as Enums<'student_status'>)}>
                    <SelectTrigger id="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom">
                      {student.status === 'matriculado' ? (
                        <>
                          <SelectItem value="matriculado">Parceria Fechada</SelectItem>
                          <SelectItem value="desistente">Negociação Perdida</SelectItem>
                          <SelectItem value="cadastro_invalido">Sem Perfil / Inválido</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="nao_confirmado">Lead Frio</SelectItem>
                          <SelectItem value="confirmado">Lead Quente</SelectItem>
                          <SelectItem value="nenhum_agendamento">Sem Contato</SelectItem>
                          <SelectItem value="atendimento_agendado">Reunião Agendada</SelectItem>
                          <SelectItem value="atendimento_recentemente">Proposta Apresentada</SelectItem>
                          <SelectItem value="atendimento_ha_mais_de_uma_semana">Aguardando Retorno</SelectItem>
                          <SelectItem value="faltou_ao_atendimento">Reunião Desmarcada</SelectItem>
                          <SelectItem value="ausente">Sem Resposta</SelectItem>
                          <SelectItem value="desistente">Negociação Perdida</SelectItem>
                          {canUpdateToMatriculado && (
                            <SelectItem value="matriculado">Parceria Fechada</SelectItem>
                          )}
                          <SelectItem value="cadastro_invalido">Sem Perfil / Inválido</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {newStatus === 'desistente' && (
                  <div>
                    <Label htmlFor="dropout-reason">Motivo da Desistência</Label>
                    <Select value={dropoutReason} onValueChange={(value) => {
                      setDropoutReason(value as Enums<'dropout_reason'>);
                    }}>
                      <SelectTrigger id="dropout-reason">
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
                    
                    {/* Campo de texto opcional para qualquer motivo */}
                    {dropoutReason && (
                      <div className="mt-3">
                        <Label htmlFor="dropout-comment">Detalhes do motivo (opcional)</Label>
                        <Textarea
                          id="dropout-comment"
                          value={dropoutComment}
                          onChange={(e) => setDropoutComment(e.target.value)}
                          placeholder="Adicione mais contexto, se desejar."
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                )}

                {newStatus === 'cadastro_invalido' && (
                  <div>
                    <Label htmlFor="invalid-reason">Motivo do Cadastro Inválido</Label>
                    <Select value={invalidReason} onValueChange={setInvalidReason}>
                      <SelectTrigger id="invalid-reason">
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent side="bottom">
                        <SelectItem value="cadastro_duplicado">Cadastro Duplicado</SelectItem>
                        <SelectItem value="cadastro_de_teste">Cadastro de Teste</SelectItem>
                        <SelectItem value="ja_e_aluno">Já é aluno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button 
                  onClick={handleUpdateStatus}
                  className={CTA_CLASS}
                  disabled={newStatus === student.status}
                >
                  Atualizar Status
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Interactions */}
          <div className="space-y-4">
            {/* Origin/Tracking Information */}
            {student.tracking_code && (
              <Card className={CARD_CLASS}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-primary">
                    <MapPin className="h-4 w-4" />
                    <span>Origem</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs font-medium text-primary">
                      Código de Rastreamento
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {student.tracking_code}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Este aluno foi cadastrado através de uma fonte rastreada
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className={CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-primary">Adicionar Comentário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Adicione um comentário sobre a escola..."
                  rows={3}
                />
                <Button 
                  onClick={handleAddInteraction}
                  className={CTA_CLASS}
                >
                  Adicionar Comentário
                </Button>
              </CardContent>
            </Card>

            <Card className={CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Histórico de Interações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {interactions.length > 0 ? (
                    interactions.map((interaction) => (
                      <div key={interaction.id} className="rounded-lg border border-slate-200 bg-muted/40 p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {(interaction as any).profiles?.name || 'Sistema'}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {new Date(interaction.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p 
                          className="text-sm text-foreground/80"
                          dangerouslySetInnerHTML={{ 
                            __html: sanitizeInteractionComment(interaction.comments || '') 
                          }}
                        />
                        <Badge variant="outline" className="mt-2 text-xs">
                          {interaction.interaction_type}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">Nenhuma interação registrada</p>
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
