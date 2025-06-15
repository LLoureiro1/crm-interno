import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, User, Phone, Mail, MapPin, GraduationCap, Percent, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Student = Tables<'students'> & {
  classes: Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  };
  cities: Tables<'cities'>;
};

type Appointment = Tables<'appointments'> & {
  profiles: Tables<'profiles'>;
};

export const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [interviewers, setInterviewers] = useState<Tables<'profiles'>[]>([]);
  const [comments, setComments] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [newStatus, setNewStatus] = useState<Enums<'student_status'>>('nao_confirmado');
  const [dropoutReason, setDropoutReason] = useState<Enums<'dropout_reason'> | ''>('');
  const [interactions, setInteractions] = useState<Tables<'student_interactions'>[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [selectedInterviewer, setSelectedInterviewer] = useState('');
  const [loading, setLoading] = useState(true);

  const canUpdateToMatriculado = profile?.profile === 'admin';
  const canRegisterAttendance = profile?.profile === 'entrevistador' || profile?.profile === 'direcao' || profile?.profile === 'admin';

  useEffect(() => {
    if (id) {
      fetchStudent();
      fetchAppointments();
      fetchInteractions();
      fetchInterviewers();
    }
  }, [id]);

  const fetchStudent = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes!inner(
            *,
            units(*),
            series(*)
          ),
          cities(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setStudent(data);
      setNewStatus(data.status);
    } catch (error) {
      console.error('Error fetching student:', error);
      toast.error('Erro ao carregar dados do aluno');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        profiles!appointments_interviewer_id_fkey(name)
      `)
      .eq('student_id', id)
      .order('appointment_date', { ascending: false });

    if (data) setAppointments(data);
  };

  const fetchInterviewers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('profile', ['entrevistador', 'direcao', 'admin']);

    if (data) setInterviewers(data);
  };

  const fetchInteractions = async () => {
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

  const hasAppointmentToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return appointments.some(apt => 
      apt.appointment_date === today && 
      apt.status === 'agendado' && 
      !apt.attended
    );
  };

  const handleScheduleAppointment = async () => {
    if (!appointmentDate || !appointmentTime || !selectedInterviewer) {
      toast.error('Preencha todos os campos do agendamento');
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          student_id: id,
          interviewer_id: selectedInterviewer,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          status: 'agendado'
        });

      if (error) throw error;

      toast.success('Agendamento criado com sucesso');
      setShowScheduleForm(false);
      setAppointmentDate('');
      setAppointmentTime('');
      setSelectedInterviewer('');
      fetchAppointments();
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      toast.error('Erro ao criar agendamento');
    }
  };

  const handleRegisterAttendance = async () => {
    if (!discountPercentage || !comments.trim()) {
      toast.error('Preencha o percentual de desconto e comentários');
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

      // Mark appointment as attended
      const todayAppointment = appointments.find(apt => {
        const today = new Date().toISOString().split('T')[0];
        return apt.appointment_date === today && apt.status === 'agendado';
      });

      if (todayAppointment) {
        await supabase
          .from('appointments')
          .update({ attended: true, discount_percentage: discount })
          .eq('id', todayAppointment.id);
      }

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
      fetchAppointments();
      fetchInteractions();
      setComments('');
      setDiscountPercentage('');
    } catch (error) {
      console.error('Error registering attendance:', error);
      toast.error('Erro ao registrar atendimento');
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

  const handleUpdateStatus = async () => {
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

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
      'nao_confirmado': { label: 'Não Confirmado', variant: 'outline' },
      'confirmado': { label: 'Confirmado', variant: 'secondary' },
      'presente': { label: 'Presente', variant: 'default' },
      'matriculado': { label: 'Matriculado', variant: 'default' },
      'desistente': { label: 'Desistente', variant: 'destructive' }
    };

    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  if (!student) {
    return <div className="flex justify-center items-center min-h-screen">Aluno não encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center space-x-4 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ficha do Aluno</h1>
            <p className="text-gray-600">
              {student.student_name} - Código: {student.code}
            </p>
          </div>
          <div className="ml-auto">
            {getStatusBadge(student.status)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student Information */}
          <div className="space-y-6">
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
                    <p>{new Date(student.birth_date).toLocaleDateString('pt-BR')}</p>
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
                    <p>{student.cities.name}</p>
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
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium">Série:</span>
                    <p>{student.classes.series.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Unidade:</span>
                    <p>{student.classes.units.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Nota Português:</span>
                    <p>{student.portuguese_grade || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Nota Matemática:</span>
                    <p>{student.math_grade || 'Não informado'}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Percent className="h-3 w-3" />
                    <span className="font-medium">Desconto:</span>
                    <p>{student.discount_percentage}%</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">Data da Inscrição:</span>
                    <p>{new Date(student.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appointments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>Agendamentos</span>
                  </div>
                  <Button
                    onClick={() => setShowScheduleForm(!showScheduleForm)}
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    Agendar Atendimento
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showScheduleForm && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="date">Data</Label>
                        <Input
                          id="date"
                          type="date"
                          value={appointmentDate}
                          onChange={(e) => setAppointmentDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="time">Horário</Label>
                        <Input
                          id="time"
                          type="time"
                          value={appointmentTime}
                          onChange={(e) => setAppointmentTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="interviewer">Entrevistador</Label>
                      <Select value={selectedInterviewer} onValueChange={setSelectedInterviewer}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o entrevistador" />
                        </SelectTrigger>
                        <SelectContent>
                          {interviewers.map((interviewer) => (
                            <SelectItem key={interviewer.id} value={interviewer.id}>
                              {interviewer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleScheduleAppointment} size="sm">
                        Confirmar Agendamento
                      </Button>
                      <Button
                        onClick={() => setShowScheduleForm(false)}
                        variant="outline"
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {appointments.length > 0 ? (
                    appointments.map((appointment) => (
                      <div key={appointment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">
                            {new Date(appointment.appointment_date).toLocaleDateString('pt-BR')} às {appointment.appointment_time}
                          </p>
                          <p className="text-sm text-gray-600">
                            Entrevistador: {appointment.profiles?.name}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={appointment.attended ? 'default' : 'outline'}>
                            {appointment.attended ? 'Realizado' : appointment.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center">Nenhum agendamento</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Register Attendance - Only show if has appointment today */}
            {canRegisterAttendance && hasAppointmentToday() && (
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
          </div>

          {/* Right Column - Actions and Interactions */}
          <div className="space-y-6">
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
