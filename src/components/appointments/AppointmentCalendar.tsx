
import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Clock, User, Building2, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateForDisplay, formatTimeForDisplay, getCurrentDate } from '@/utils/dateUtils';
import type { Tables } from '@/integrations/supabase/types';

type Appointment = Tables<'appointments'> & {
  students: Tables<'students'> & {
    classes: Tables<'classes'> & {
      series: Tables<'series'>;
      units: Tables<'units'>;
    };
  };
  profiles: Tables<'profiles'>;
};

interface AppointmentCalendarProps {
  onDateSelect?: (date: string) => void;
}

export const AppointmentCalendar = ({ onDateSelect }: AppointmentCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [units, setUnits] = useState<Tables<'units'>[]>([]);
  const [series, setSeries] = useState<Tables<'series'>[]>([]);
  const [interviewers, setInterviewers] = useState<Tables<'profiles'>[]>([]);
  const [filters, setFilters] = useState({
    unit: '',
    series: '',
    interviewer: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAppointments();
    }
  }, [selectedDate]);

  useEffect(() => {
    applyFilters();
  }, [appointments, filters]);

  const fetchFiltersData = async () => {
    const [unitsData, seriesData, interviewersData] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('series').select('*').order('name'),
      supabase.from('profiles').select('*').in('profile', ['entrevistador', 'direcao', 'admin']).order('name')
    ]);

    if (unitsData.data) setUnits(unitsData.data);
    if (seriesData.data) setSeries(seriesData.data);
    if (interviewersData.data) setInterviewers(interviewersData.data);
  };

  const fetchAppointments = async () => {
    setLoading(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        students!inner(
          *,
          classes!inner(
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
      console.error('Error fetching appointments:', error);
      toast.error('Erro ao carregar agendamentos');
      setLoading(false);
      return;
    }

    setAppointments(data || []);
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = appointments;

    if (filters.unit) {
      filtered = filtered.filter(apt => apt.students?.classes?.unit_id === filters.unit);
    }

    if (filters.series) {
      filtered = filtered.filter(apt => apt.students?.classes?.series_id === filters.series);
    }

    if (filters.interviewer) {
      filtered = filtered.filter(apt => apt.interviewer_id === filters.interviewer);
    }

    setFilteredAppointments(filtered);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      onDateSelect?.(date.toISOString().split('T')[0]);
    }
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Status atualizado com sucesso');
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: string, attended: boolean) => {
    if (attended) {
      return <Badge className="bg-green-500">Realizado</Badge>;
    }

    switch (status) {
      case 'agendado':
        return <Badge variant="secondary">Agendado</Badge>;
      case 'cancelado':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'faltou':
        return <Badge variant="destructive">Faltou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Unidade</label>
              <Select value={filters.unit} onValueChange={(value) => setFilters(prev => ({ ...prev, unit: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as unidades</SelectItem>
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
                  <SelectItem value="">Todas as séries</SelectItem>
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
                  <SelectItem value="">Todos os entrevistadores</SelectItem>
                  {interviewers.map(interviewer => (
                    <SelectItem key={interviewer.id} value={interviewer.id}>{interviewer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => setFilters({ unit: '', series: '', interviewer: '' })}
              variant="outline"
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Agendamentos para {formatDateForDisplay(selectedDate.toISOString().split('T')[0])}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8">Carregando agendamentos...</p>
          ) : filteredAppointments.length > 0 ? (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <div key={appointment.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          {formatTimeForDisplay(appointment.appointment_time)}
                        </span>
                      </div>
                      {getStatusBadge(appointment.status, appointment.attended || false)}
                    </div>
                    <div className="flex space-x-2">
                      {!appointment.attended && appointment.status !== 'faltou' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id, 'faltou')}
                            variant="outline"
                            className="text-red-600"
                          >
                            Marcar Falta
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id, 'realizado')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Marcar Realizado
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Aluno:</span>
                      <span>{appointment.students?.student_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Unidade:</span>
                      <span>{appointment.students?.classes?.units?.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Série:</span>
                      <span>{appointment.students?.classes?.series?.name}</span>
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="font-medium">Entrevistador:</span> {appointment.profiles?.name}
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
            <p className="text-gray-500 text-center py-8">
              Nenhum agendamento encontrado para esta data
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
