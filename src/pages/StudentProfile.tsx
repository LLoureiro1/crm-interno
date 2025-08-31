import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Phone, Mail, MapPin, GraduationCap, Percent, Clock, ArrowLeft, Home } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';
import { formatDateForDisplay, formatTimeForDisplay } from '@/utils/dateUtils';

type Student = Tables<'students'> & {
  classes: Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  };
};

type Profile = Tables<'profiles'>;

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [interviewers, setInterviewers] = useState<Profile[]>([]);
  const [comments, setComments] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [newStatus, setNewStatus] = useState<Enums<'student_status'> | ''>('');
  const [dropoutReason, setDropoutReason] = useState<Enums<'dropout_reason'> | ''>('');
  const [interactions, setInteractions] = useState<Tables<'student_interactions'>[]>([]);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewerId, setInterviewerId] = useState('');
  const [availableExamDates, setAvailableExamDates] = useState<Tables<'exam_dates'>[]>([]);
  const [selectedExamDateId, setSelectedExamDateId] = useState<string>('');
  const [showExamDateEditor, setShowExamDateEditor] = useState(false);

  const canUpdateToMatriculado = profile?.profile === 'admin';
  const canRegisterAttendance = profile?.profile === 'entrevistador' || profile?.profile === 'direcao' || profile?.profile === 'admin';
  
  // Verificar se hoje é o dia da entrevista
  const today = new Date().toISOString().split('T')[0];
  const isInterviewDay = student?.interview_date === today;

  useEffect(() => {
    if (id) {
      fetchStudent();
      fetchInterviewers();
    }
  }, [id]);

  useEffect(() => {
    if (student) {
      setNewStatus(student.status);
      fetchInteractions();
      fetchAvailableExamDates();
    }
  }, [student]);

  const fetchStudent = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        classes!inner(
          *,
          units(*),
          series(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching student:', error);
      toast.error('Erro ao carregar dados do aluno');
      return;
    }

    setStudent(data);
  };

  const fetchInterviewers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('profile', ['entrevistador', 'direcao', 'admin'])
      .order('name');

    if (error) {
      console.error('Error fetching interviewers:', error);
      return;
    }

    setInterviewers(data || []);
  };

  const fetchInteractions = async () => {
    if (!id) return;

    const { data } = await supabase
      .from('student_interactions')
      .select(`
        *,
        profiles(name)
      `)
      .eq('student_id', id)
      .order('created_at', { ascending: false });

    if (data) setInteractions(data);
  };

  const fetchAvailableExamDates = async () => {
    if (!student?.classes?.unit_id) return;

    const { data, error } = await supabase
      .from('exam_dates')
      .select('*')
      .eq('unit_id', student.classes.unit_id)
      .gte('exam_date', new Date().toISOString().split('T')[0])
      .order('exam_date', { ascending: true })
      .order('exam_time', { ascending: true });

    if (error) {
      console.error('Error fetching available exam dates:', error);
      return;
    }

    setAvailableExamDates(data || []);

    // Definir a data atual do aluno como selecionada se existir
    if (student?.exam_date_id) {
      setSelectedExamDateId(student.exam_date_id);
    }
  };

  const handleScheduleInterview = async () => {
    if (!interviewDate || !interviewTime || !interviewerId) {
      toast.error('Preencha todos os campos da entrevista');
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update({ 
          interview_date: interviewDate,
          status: 'atendimento_agendado'
        })
        .eq('id', id);

      if (error) throw error;

      // Add interaction
      await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'agendamento_entrevista',
          comments: `Entrevista agendada para ${formatDateForDisplay(interviewDate)} às ${interviewTime} com ${interviewers.find(i => i.id === interviewerId)?.name}. Status automaticamente alterado para "Atendimento Agendado".`,

        });

      // Add appointment record
      await supabase
        .from('appointments')
        .insert({
          student_id: id,
          interviewer_id: interviewerId,
          appointment_date: interviewDate,
          appointment_time: interviewTime,
          status: 'scheduled' // Assuming a default status for new appointments
        });

      toast.success('Entrevista agendada com sucesso e status atualizado!');
      fetchStudent();
      fetchInteractions();
      setInterviewDate('');
      setInterviewTime('');
      setInterviewerId('');
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast.error('Erro ao agendar entrevista');
    }
  };

  const handleAddInteraction = async () => {
    if (!comments.trim()) {
      toast.error('Adicione um comentário');
      return;
    }

    try {
      const { error } = await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'comentario',
          comments: comments.trim()
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

  const handleRegisterAttendance = async () => {
    if (!discountPercentage) {
      toast.error('Preencha o percentual de desconto');
      return;
    }

    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast.error('Percentual de desconto inválido');
      return;
    }

    try {
      // Update student with discount and status
      const { error: studentError } = await supabase
        .from('students')
        .update({
          discount_percentage: discount,
          status: 'atendimento_recentemente'
        })
        .eq('id', id);

      if (studentError) throw studentError;

      // Add interaction
      const { error: interactionError } = await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'atendimento',
          comments: `Atendimento realizado. Desconto: ${discount}%. ${comments.trim()}`
        });

      if (interactionError) throw interactionError;

      toast.success('Atendimento registrado com sucesso');
      fetchStudent();
      fetchInteractions();
      setDiscountPercentage('');
      setComments('');
    } catch (error) {
      console.error('Error registering attendance:', error);
      toast.error('Erro ao registrar atendimento');
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    
    if (newStatus === 'desistente' && !dropoutReason) {
      toast.error('Selecione o motivo da desistência');
      return;
    }

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'desistente') {
        updateData.dropout_reason = dropoutReason;
      }

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Add interaction
      await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'mudanca_status',
          comments: `Status alterado para: ${newStatus}${newStatus === 'desistente' ? ` (Motivo: ${dropoutReason})` : ''}`
        });

      toast.success('Status atualizado com sucesso');
      fetchStudent();
      fetchInteractions();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleChangeExamDate = async () => {
    if (!selectedExamDateId || !student?.id) {
      toast.error('Selecione uma data de prova válida');
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update({ exam_date_id: selectedExamDateId })
        .eq('id', student.id);

      if (error) throw error;

      // Adicionar interação
      const selectedExamDate = availableExamDates.find(ed => ed.id === selectedExamDateId);
      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: profile?.id,
          interaction_type: 'mudanca_data_prova',
          comments: `Data da prova alterada para ${formatDateForDisplay(selectedExamDate?.exam_date || '')} às ${selectedExamDate?.exam_time.substring(0, 5) || ''}`
        });

      toast.success('Data da prova alterada com sucesso!');
      setShowExamDateEditor(false);
      fetchStudent();
      fetchInteractions();
    } catch (error) {
      console.error('Error changing exam date:', error);
      toast.error('Erro ao alterar data da prova');
    }
  };

  const getStatusBadge = (status: string) => {
      const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "purple" | "warning" } } = {
        'nao_confirmado': { label: 'Não Confirmado', variant: 'outline' },
        'confirmado': { label: 'Confirmado', variant: 'secondary' },
        'presente': { label: 'Presente', variant: 'default' },
        'matriculado': { label: 'Matriculado', variant: 'success' },
        'desistente': { label: 'Desistente', variant: 'destructive' },
        'nenhum_agendamento': { label: 'Nenhum Agendamento', variant: 'outline' },
        'atendimento_agendado': { label: 'Atendimento Agendado', variant: 'secondary' },
        'faltou_ao_atendimento': { label: 'Faltou ao Atendimento', variant: 'purple' },
        'atendimento_recentemente': { label: 'Atendimento Recentemente', variant: 'default' },
        'atendimento_ha_mais_de_uma_semana': { label: 'Atendimento há mais de uma semana', variant: 'warning' },
        'ausente': { label: 'Ausente', variant: 'destructive' }
      };

      const config = statusMap[status] || { label: status, variant: 'outline' as const };
      return <Badge variant={config.variant}>{config.label}</Badge>;
    };

  if (!student) {
    return (
      <div className="min-h-screen bg-blue-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="flex items-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>Tela Inicial</span>
            </Button>
            <Button 
              onClick={() => window.history.back()} 
              variant="outline" 
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar</span>
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <User className="h-6 w-6" />
            <span>Ficha do Aluno - {student.student_name}</span>
          </h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-gray-600">Código: {student.code}</span>
            <span>|</span>
            <span>Status: {getStatusBadge(student.status)}</span>
          </div>
        </div>

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
                    <p>{student.city || 'Não informado'}</p>
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
                  {student.classes?.has_exam && (
                    <>
                      <div>
                        <span className="font-medium">Nota Português:</span>
                        <p>{student.portuguese_grade || 'Não informado'}</p>
                      </div>
                      <div>
                        <span className="font-medium">Nota Matemática:</span>
                        <p>{student.math_grade || 'Não informado'}</p>
                      </div>
                    </>
                  )}
                  <div className="flex items-center space-x-1">
                    <Percent className="h-3 w-3" />
                    <span className="font-medium">Desconto:</span>
                    <p>{student.discount_percentage}%</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">Data da Inscrição:</span>
                    <p>{formatDateForDisplay(student.created_at.split('T')[0])}</p>
                  </div>
                  {student.classes?.has_exam && (
                    <div className="col-span-2">
                      <span className="font-medium">Data da Prova:</span>
                      {student.exam_date ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <p>{formatDateForDisplay(student.exam_date)}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              fetchAvailableExamDates();
                              setShowExamDateEditor(!showExamDateEditor);
                            }}
                          >
                            {showExamDateEditor ? 'Cancelar' : 'Alterar'}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-gray-500">Não informado</p>
                      )}
                      
                      {/* Editor de data da prova */}
                      {showExamDateEditor && availableExamDates.length > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <Label htmlFor="exam-date-select">Nova Data da Prova</Label>
                          <div className="flex items-center space-x-2 mt-2">
                            <Select 
                              value={selectedExamDateId} 
                              onValueChange={setSelectedExamDateId}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Selecione uma nova data" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableExamDates.map(examDate => (
                                  <SelectItem key={examDate.id} value={examDate.id}>
                                    {formatDateForDisplay(examDate.exam_date)} às {examDate.exam_time.substring(0, 5)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={handleChangeExamDate}
                              disabled={!selectedExamDateId || selectedExamDateId === student?.exam_date_id}
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600"
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">Data da Entrevista:</span>
                    <p className={isInterviewDay ? 'text-green-600 font-bold' : ''}>
                      {formatDateForDisplay(student.interview_date)}
                      {isInterviewDay && ' (HOJE)'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interview Scheduling */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Agendar Entrevista</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="interview-date">Data</Label>
                    <Input
                      id="interview-date"
                      type="date"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="interview-time">Horário</Label>
                    <Input
                      id="interview-time"
                      type="time"
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="interviewer">Entrevistador</Label>
                    <Select value={interviewerId} onValueChange={setInterviewerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {interviewers.map(interviewer => (
                          <SelectItem key={interviewer.id} value={interviewer.id}>
                            {interviewer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={handleScheduleInterview}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Agendar Entrevista
                </Button>
              </CardContent>
            </Card>

            {/* Actions - Only show Register Attendance if it's interview day */}
            {canRegisterAttendance && isInterviewDay && student.status !== 'atendimento_recentemente' && (
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Atendimento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="discount">Percentual de Desconto (%)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      max="100"
                      step="2.5"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      placeholder="Ex: 10.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="attendance-comments">Comentários</Label>
                    <Textarea
                      id="attendance-comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Descreva o atendimento realizado..."
                    />
                  </div>
                  <Button 
                    onClick={handleRegisterAttendance}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    Registrar Atendimento
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Status Update */}
            <Card>
              <CardHeader>
                <CardTitle>Atualizar Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="status">Novo Status</Label>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as Enums<'student_status'>)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_confirmado">Não Confirmado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="presente">Presente</SelectItem>
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
                    <Label htmlFor="dropout-reason">Motivo da Desistência</Label>
                    <Select value={dropoutReason} onValueChange={(value) => setDropoutReason(value as Enums<'dropout_reason'>)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="impossibilidade_contato">Impossibilidade de contato</SelectItem>
                        <SelectItem value="cadastro_duplicado">Cadastro Duplicado</SelectItem>
                        <SelectItem value="matriculou_outra_escola">Matriculou em Outra Escola</SelectItem>
                        <SelectItem value="motivos_financeiros">Motivos Financeiros</SelectItem>
                        <SelectItem value="falta_vaga">Falta de Vaga</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
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
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
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
                        <p className="text-sm text-gray-700">{interaction.comments}</p>
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
      </div>
    </div>
  );
};

export default StudentProfile;
