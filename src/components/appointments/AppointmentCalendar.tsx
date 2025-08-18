
import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { CalendarIcon, CalendarX, Clock, User, Building2, GraduationCap, Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateForDisplay, formatTimeForDisplay, getCurrentDate } from '@/utils/dateUtils';
import type { Tables } from '@/integrations/supabase/types';

type Appointment = Tables<'appointments'> & {
  students?: Tables<'students'> & {
    student_name?: string;
    classes?: Tables<'classes'> & {
      series?: Tables<'series'>;
      units?: Tables<'units'>;
      series_id?: string;
      unit_id?: string;
    };
  };
  profiles?: Tables<'profiles'>;
  unit?: { id: string; name: string };
  series?: { id: string; name: string };
  interviewer?: { id: string; name: string };
};

interface AppointmentCalendarProps {
  onDateSelect?: (date: string) => void;
}

export const AppointmentCalendar = ({ onDateSelect }: AppointmentCalendarProps) => {
  // Inicializa com a data atual
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const { profile } = useAuth();
  
  // Log para depuração da data selecionada
  useEffect(() => {
    console.log('Data selecionada inicializada:', selectedDate, selectedDate.toISOString().split('T')[0]);
  }, []);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  
  // Log para depuração dos estados
  useEffect(() => {
    console.log('Estado de appointments atualizado:', appointments);
  }, [appointments]);
  
  useEffect(() => {
    console.log('Estado de filteredAppointments atualizado:', filteredAppointments);
  }, [filteredAppointments]);
  
  // Inicialização para garantir que filteredAppointments seja sempre um array
  useEffect(() => {
    console.log('Component mounted, initializing states');
    setFilteredAppointments([]);
  }, []);
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [interviewers, setInterviewers] = useState<Tables<'profiles'>[]>([]);
  const [filters, setFilters] = useState({ unit: 'all', series: 'all', interviewer: 'all' });
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [attendanceDiscount, setAttendanceDiscount] = useState('');
  const [attendanceComments, setAttendanceComments] = useState('');

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    console.log('Data selecionada mudou:', selectedDate);
    if (selectedDate) {
      fetchAppointments();
    }
  }, [selectedDate]);
  
  // Inicializar filteredAppointments como um array vazio
  useEffect(() => {
    setFilteredAppointments([]);
  }, []);

  useEffect(() => {
    console.log('Appointments or filters changed, reapplying filters');
    console.log('Current appointments:', appointments);
    console.log('Current filters:', filters);
    applyFilters();
  }, [appointments, filters]);
  
  // Log filtered appointments whenever they change
  useEffect(() => {
    console.log('Filtered appointments updated:', filteredAppointments);
  }, [filteredAppointments]);

  const fetchFiltersData = async () => {
    setFiltersLoading(true);
    try {
      const [unitsData, seriesData, interviewersData] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        supabase.from('series').select('*').order('name'),
        supabase.from('profiles').select('*').in('profile', ['entrevistador', 'direcao', 'admin']).order('name')
      ]);

      if (unitsData.error) throw unitsData.error;
      if (seriesData.error) throw seriesData.error;
      if (interviewersData.error) throw interviewersData.error;

      setUnits(unitsData.data || []);
      setSeries(seriesData.data || []);
      setInterviewers(interviewersData.data || []);
      
      console.log('Filters loaded:', {
        units: unitsData.data?.length || 0,
        series: seriesData.data?.length || 0,
        interviewers: interviewersData.data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching filters data:', error);
      toast.error('Erro ao carregar dados de filtros');
    } finally {
      setFiltersLoading(false);
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    // Verificar se o usuário está autenticado antes de fazer a consulta
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      console.error('Usuário não autenticado');
      toast.error('Você precisa estar logado para ver os agendamentos');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Buscando agendamentos para a data:', dateStr);
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          students!left(
            *,
            classes!left(
              *,
              series(*),
              units(*)
            )
          ),
          profiles!appointments_interviewer_id_fkey(*)
        `)
        .eq('appointment_date', dateStr)
        .order('appointment_time');

      if (error) {
        throw error;
      }

      console.log('Agendamentos carregados:', data?.length || 0, data);
      
      if (data && data.length > 0) {
        setAppointments(data);
      } else {
        setAppointments([]);
        setFilteredAppointments([]);
        console.log('Nenhum agendamento encontrado para esta data:', dateStr);
      }
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
      setAppointments([]);
      setFilteredAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    console.log('Aplicando filtros:', filters, 'to appointments:', appointments.length);
    
    if (!appointments || appointments.length === 0) {
      console.log('Nenhum agendamento para filtrar');
      setFilteredAppointments([]);
      return;
    }
    
    let filtered = [...appointments];

    if (filters.unit && filters.unit !== 'all') {
      filtered = filtered.filter(apt => {
        const unitMatch = apt.students?.classes?.unit_id === filters.unit;
        if (!unitMatch) {
          console.log('Agendamento não corresponde ao filtro de unidade:', apt.id);
        }
        return unitMatch;
      });
      console.log('After unit filter:', filtered.length);
    }

    if (filters.series && filters.series !== 'all') {
      filtered = filtered.filter(apt => {
        const seriesMatch = apt.students?.classes?.series_id === filters.series;
        if (!seriesMatch) {
          console.log('Agendamento não corresponde ao filtro de série:', apt.id);
        }
        return seriesMatch;
      });
      console.log('After series filter:', filtered.length);
    }

    if (filters.interviewer && filters.interviewer !== 'all') {
      filtered = filtered.filter(apt => {
        const interviewerMatch = apt.interviewer_id === filters.interviewer;
        if (!interviewerMatch) {
          console.log('Agendamento não corresponde ao filtro de entrevistador:', apt.id);
        }
        return interviewerMatch;
      });
      console.log('After interviewer filter:', filtered.length);
    }

    console.log('Final filtered appointments:', filtered.length);
    setFilteredAppointments(filtered);
  };

  const handleDateSelect = (date: Date | undefined) => {
    console.log('Date selected:', date);
    if (date) {
      setSelectedDate(date);
      const dateStr = date.toISOString().split('T')[0];
      console.log('Formatted date for API:', dateStr);
      onDateSelect?.(dateStr);
    }
  };

  const handleOpenAttendanceModal = (appointment: Appointment) => {
    setCurrentAppointment(appointment);
    setShowAttendanceModal(true);
  };

  const handleRegisterAttendance = async () => {
    if (!currentAppointment) return;
    if (!attendanceDiscount) {
      toast.error('Preencha o percentual de desconto');
      return;
    }

    const discount = parseFloat(attendanceDiscount);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast.error('Percentual de desconto inválido');
      return;
    }

    try {
      // Update appointment with status 'realizado', discount, and comments
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'realizado',
          attended: true,
          discount_percentage: discount,
          comments: attendanceComments.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentAppointment.id);

      if (error) throw error;

      // Update student's discount_percentage and status
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({ 
          discount_percentage: discount,
          status: 'atendimento_recentemente' // Placeholder for now, will verify later
        })
        .eq('id', currentAppointment.student_id);

      if (studentUpdateError) throw studentUpdateError;

      // Add interaction
      const { error: interactionError } = await supabase
        .from('student_interactions')
        .insert({
          student_id: currentAppointment.student_id,
          user_id: profile?.id, // Assuming profile is available in this component
          interaction_type: 'atendimento',
          comments: `Atendimento realizado. Desconto: ${discount}%. ${attendanceComments.trim() || 'Sem comentários.'}`
        });

      if (interactionError) throw interactionError;

      toast.success('Atendimento registrado com sucesso');
      setShowAttendanceModal(false);
      setCurrentAppointment(null);
      setAttendanceDiscount('');
      setAttendanceComments('');
      fetchAppointments();
    } catch (error) {
      console.error('Error registering attendance:', error);
      toast.error('Erro ao registrar atendimento');
    }
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    const appointmentToUpdate = appointments.find(apt => apt.id === appointmentId);
    if (!appointmentToUpdate) {
      console.error('Appointment not found for status update:', appointmentId);
      toast.error('Agendamento não encontrado.');
      return;
    }
    try {
      // Atualiza o estado local para feedback imediato ao usuário
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status: newStatus, attended: newStatus === 'realizado' || newStatus === 'faltou' } 
            : apt
        )
      );
      
      // Atualiza no banco de dados
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: newStatus,
          attended: newStatus === 'realizado' || newStatus === 'faltou',
          // Status is already set above, no need to set it again
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;

      // If the new status is 'faltou', update the student's status as well
      if (newStatus === 'faltou') {
        const { error: studentUpdateError } = await supabase
          .from('students')
          .update({ status: 'faltou_ao_atendimento' })
           .eq('id', appointmentToUpdate.student_id);

        if (studentUpdateError) throw studentUpdateError;
      }

      toast.success('Status atualizado com sucesso');
      // Recarrega os dados para garantir sincronização
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Erro ao atualizar status');
      // Recarrega os dados em caso de erro para restaurar o estado correto
      fetchAppointments();
    }
  };

  const getStatusBadge = (status: string, attended: boolean) => {
    switch (status) {
      case 'agendado':
        return <Badge variant="secondary">Agendado</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">Agendado</Badge>;
      case 'cancelado':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'faltou':
        return <Badge variant="destructive">Faltou</Badge>;
      case 'realizado':
        return <Badge className="bg-green-500">Realizado</Badge>;
      case 'faltou':
        return <Badge variant="destructive">Faltou</Badge>;
      default:
        return <Badge variant="outline">{status || 'Pendente'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Selecionar Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && appointments.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="rounded-md border"
                initialFocus
                today={today}
              />
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filtersLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">Unidade</label>
                  <Select value={filters.unit} onValueChange={(value) => setFilters(prev => ({ ...prev, unit: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as unidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as unidades</SelectItem>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Série</label>
                  <Select value={filters.series} onValueChange={(value) => setFilters(prev => ({ ...prev, series: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as séries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as séries</SelectItem>
                      {series.map(serie => (
                        <SelectItem key={serie.id} value={serie.id}>{serie.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Entrevistador</label>
                  <Select value={filters.interviewer} onValueChange={(value) => setFilters(prev => ({ ...prev, interviewer: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os entrevistadores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os entrevistadores</SelectItem>
                      {interviewers.map(interviewer => (
                        <SelectItem key={interviewer.id} value={interviewer.id}>{interviewer.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={() => setFilters({ unit: 'all', series: 'all', interviewer: 'all' })}
                  variant="outline"
                  className="w-full"
                >
                  Limpar Filtros
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ClipboardList className="h-5 w-5" />
            <span>Agendamentos para {formatDateForDisplay(selectedDate.toISOString().split('T')[0])}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Carregando agendamentos...</span>
              </div>
            ) : filteredAppointments && filteredAppointments.length > 0 ? (
              <div className="space-y-4">
                {filteredAppointments.map((appointment) => (
                <div key={appointment.id} className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          {appointment.appointment_time ? formatTimeForDisplay(appointment.appointment_time) : 'Horário não definido'}
                        </span>
                      </div>
                      {getStatusBadge(appointment.status || '', appointment.attended || false)}
                    </div>
                    <div className="flex space-x-2">
                      {appointment.status !== 'realizado' && 
                       appointment.status !== 'faltou' && 
                       appointment.students?.status !== 'atendimento_recentemente' && ( 
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id, 'faltou')}
                            variant="outline"
                            className="text-red-600"
                            disabled={loading}
                          >
                            Marcar Falta
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenAttendanceModal(appointment)}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={loading}
                          >
                            Atender
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Aluno:</span>
                      <span>{appointment.students?.student_name || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Unidade:</span>
                      <span>
                        {appointment.students?.classes?.units?.name || 
                         appointment.unit?.name || 
                         'Não informada'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Série:</span>
                      <span>
                        {appointment.students?.classes?.series?.name || 
                         appointment.series?.name || 
                         'Não informada'}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="font-medium">Entrevistador:</span> 
                    {appointment.profiles?.name || 
                     appointment.interviewer?.name || 
                     'Não informado'}
                  </div>

                  {appointment.comments && (
                    <div className="text-sm">
                      <span className="font-medium">Comentários:</span> {appointment.comments}
                    </div>
                  )}

                  {appointment.discount_percentage && (
                    <div className="text-sm">
                      <span className="font-medium">Desconto:</span> {appointment.discount_percentage}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarX className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Nenhum agendamento encontrado para esta data.</p>
              <p className="text-sm text-gray-400 mt-1">Tente selecionar outra data ou ajustar os filtros.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Atendimento</DialogTitle>
            <DialogDescription>
              Preencha os detalhes do atendimento para {currentAppointment?.students?.student_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="discount" className="text-right">Percentual de Desconto</label>
              <Input
                id="discount"
                type="number"
                value={attendanceDiscount}
                onChange={(e) => setAttendanceDiscount(e.target.value)}
                className="col-span-3"
                placeholder="Ex: 10, 20, 50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="comments" className="text-right">Comentários</label>
              <Textarea
                id="comments"
                value={attendanceComments}
                onChange={(e) => setAttendanceComments(e.target.value)}
                className="col-span-3"
                placeholder="Observações sobre o atendimento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttendanceModal(false)}>Cancelar</Button>
            <Button onClick={handleRegisterAttendance}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
