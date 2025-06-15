
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calendar, Clock, User, Phone, Mail, MapPin, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'> & {
  cities: { name: string };
  classes: { name: string };
  units: { name: string };
};

type Appointment = Tables<'appointments'> & {
  profiles: { name: string } | null;
};

type InterviewerAvailability = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  interviewer_id: string;
  profiles: { name: string };
};

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilities, setAvailabilities] = useState<InterviewerAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    date: '',
    time: '',
    interviewerId: ''
  });
  const [attendanceData, setAttendanceData] = useState({
    comments: '',
    discountPercentage: 0
  });

  useEffect(() => {
    if (id) {
      fetchStudentData();
      fetchAppointments();
      fetchAvailabilities();
    }
  }, [id]);

  const fetchStudentData = async () => {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        cities(name),
        classes(name),
        units(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching student:', error);
      toast.error('Erro ao carregar dados do aluno');
      return;
    }

    setStudent(data);
    setLoading(false);
  };

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        profiles(name)
      `)
      .eq('student_id', id)
      .order('appointment_date', { ascending: false });

    if (error) {
      console.error('Error fetching appointments:', error);
      return;
    }

    setAppointments(data || []);
  };

  const fetchAvailabilities = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('interviewer_availability')
      .select(`
        *,
        profiles(name)
      `)
      .gte('date', today)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching availabilities:', error);
      return;
    }

    setAvailabilities(data || []);
  };

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduleData.date || !scheduleData.time || !scheduleData.interviewerId) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          student_id: id,
          interviewer_id: scheduleData.interviewerId,
          appointment_date: scheduleData.date,
          appointment_time: scheduleData.time,
          status: 'agendado'
        });

      if (error) throw error;

      toast.success('Atendimento agendado com sucesso');
      setScheduleData({ date: '', time: '', interviewerId: '' });
      setShowScheduleForm(false);
      fetchAppointments();
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      toast.error('Erro ao agendar atendimento');
    }
  };

  const handleRegisterAttendance = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          attended: true,
          comments: attendanceData.comments,
          discount_percentage: attendanceData.discountPercentage,
          status: 'concluido'
        })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Presença registrada com sucesso');
      setAttendanceData({ comments: '', discountPercentage: 0 });
      fetchAppointments();
    } catch (error) {
      console.error('Error registering attendance:', error);
      toast.error('Erro ao registrar presença');
    }
  };

  const getTodayAppointments = () => {
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter(apt => apt.appointment_date === today && apt.status === 'agendado');
  };

  const getAvailableTimesForDate = (date: string, interviewerId: string) => {
    return availabilities
      .filter(av => av.date === date && av.interviewer_id === interviewerId)
      .map(av => ({
        start: av.start_time,
        end: av.end_time
      }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!student) {
    return (
      <Layout>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Aluno não encontrado</h2>
          <Button onClick={() => navigate('/')}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  const todayAppointments = getTodayAppointments();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{student.student_name}</h1>
            <p className="text-gray-600">Código: {student.code}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Dados Pessoais</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Aluno</Label>
                  <p className="font-medium">{student.student_name}</p>
                </div>
                <div>
                  <Label>Responsável</Label>
                  <p className="font-medium">{student.responsible_name}</p>
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <p className="font-medium">
                    {new Date(student.birth_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <p className="font-medium">{student.phone}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <p className="font-medium">{student.email}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <p className="font-medium">{student.cities.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados Acadêmicos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Dados Acadêmicos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unidade</Label>
                  <p className="font-medium">{student.units.name}</p>
                </div>
                <div>
                  <Label>Turma</Label>
                  <p className="font-medium">{student.classes.name}</p>
                </div>
                <div>
                  <Label>Escola de Origem</Label>
                  <p className="font-medium">{student.origin_school}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="font-medium capitalize">{student.status.replace('_', ' ')}</p>
                </div>
                {student.math_grade && (
                  <div>
                    <Label>Nota Matemática</Label>
                    <p className="font-medium">{student.math_grade}</p>
                  </div>
                )}
                {student.portuguese_grade && (
                  <div>
                    <Label>Nota Português</Label>
                    <p className="font-medium">{student.portuguese_grade}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agendamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Agendamentos</span>
              </div>
              <Button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Agendar Atendimento
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showScheduleForm && (
              <form onSubmit={handleScheduleAppointment} className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduleData.date}
                      onChange={(e) => setScheduleData(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="interviewer">Entrevistador</Label>
                    <Select
                      value={scheduleData.interviewerId}
                      onValueChange={(value) => setScheduleData(prev => ({ ...prev, interviewerId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o entrevistador" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(availabilities.map(av => av.interviewer_id))).map((interviewerId) => {
                          const interviewer = availabilities.find(av => av.interviewer_id === interviewerId)?.profiles;
                          return (
                            <SelectItem key={interviewerId} value={interviewerId}>
                              {interviewer?.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="time">Horário</Label>
                    <Select
                      value={scheduleData.time}
                      onValueChange={(value) => setScheduleData(prev => ({ ...prev, time: value }))}
                      disabled={!scheduleData.date || !scheduleData.interviewerId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {scheduleData.date && scheduleData.interviewerId && 
                          getAvailableTimesForDate(scheduleData.date, scheduleData.interviewerId).map((timeSlot, index) => (
                            <SelectItem key={index} value={timeSlot.start}>
                              {timeSlot.start} - {timeSlot.end}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                    Agendar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowScheduleForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            {/* Lista de Agendamentos */}
            <div className="space-y-4">
              {appointments.length > 0 ? (
                appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          {new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{appointment.appointment_time}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">
                          {appointment.profiles?.name || 'Entrevistador não definido'}
                        </span>
                      </div>
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          appointment.status === 'agendado' ? 'bg-blue-100 text-blue-800' :
                          appointment.status === 'concluido' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {appointment.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Nenhum agendamento encontrado
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Registrar Atendimento - Apenas para agendamentos de hoje */}
        {todayAppointments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Registrar Atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="comments">Observações</Label>
                  <Textarea
                    id="comments"
                    placeholder="Digite as observações do atendimento..."
                    value={attendanceData.comments}
                    onChange={(e) => setAttendanceData(prev => ({ ...prev, comments: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="discount">Percentual de Desconto (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    max="100"
                    value={attendanceData.discountPercentage}
                    onChange={(e) => setAttendanceData(prev => ({ ...prev, discountPercentage: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Agendamentos de Hoje</Label>
                  {todayAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{appointment.appointment_time}</span>
                        <span className="text-gray-600">
                          - {appointment.profiles?.name || 'Entrevistador não definido'}
                        </span>
                      </div>
                      <Button
                        onClick={() => handleRegisterAttendance(appointment.id)}
                        className="bg-green-500 hover:bg-green-600"
                        size="sm"
                      >
                        Registrar Presença
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
