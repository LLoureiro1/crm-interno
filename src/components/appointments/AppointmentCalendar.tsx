
import { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUnitAccess } from '@/hooks/useUnitAccess';
import { CalendarIcon, CalendarX, Clock, User, Building2, GraduationCap, Loader2, ClipboardList, Trash2, DollarSign, AlertCircle, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateForDisplay, formatTimeForDisplay, getCurrentDate, dateToLocalString } from '@/utils/dateUtils';
import type { Tables } from '@/integrations/supabase/types';
import { MaterialPaymentSelector, type MaterialPaymentType } from '@/components/ui/MaterialPaymentSelector';
import { MaterialDidaticoCalculator } from '@/components/ui/MaterialDidaticoCalculator';
import { getSegmentLabel, getSeriesIdsForSegment, sortSegments } from '@/utils/educationLevel';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

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
  profiles?: Pick<Tables<'profiles'>, 'name'>;
  unit?: { id: string; name: string };
  series?: { id: string; name: string };
  interviewer?: { id: string; name: string };
};

interface AppointmentCalendarProps {
  onDateSelect?: (date: string) => void;
  view?: 'full' | 'list';
  onTodayCountChange?: (count: number) => void;
}

export function AppointmentCalendar({ onDateSelect, view = 'full', onTodayCountChange }: AppointmentCalendarProps) {
  // Inicializa com a data atual
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const { profile } = useAuth();
  const { fullAccess, allowedUnitIds } = useUnitAccess();
  
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
  const [interviewers, setInterviewers] = useState<Tables<'staff_directory'>[]>([]);
  const [filters, setFilters] = useState({ unit: 'all', segment: 'all', series: 'all', interviewer: 'all' });

  const availableSegments = useMemo(
    () => sortSegments(series.map((s) => s.level)),
    [series]
  );

  const filteredSeriesOptions = useMemo(() => {
    if (filters.segment === 'all') return series;
    return series.filter((s) => s.level === filters.segment);
  }, [series, filters.segment]);

  const handleSegmentChange = (value: string) => {
    setFilters((prev) => ({ ...prev, segment: value, series: 'all' }));
  };
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [attendanceDiscount, setAttendanceDiscount] = useState('');
  const [attendanceComments, setAttendanceComments] = useState('');
  const [materialPaymentType, setMaterialPaymentType] = useState<MaterialPaymentType>('');
  const [materialInstallments, setMaterialInstallments] = useState<number>(2);
  const [tuitionInstallments, setTuitionInstallments] = useState<number>(12);

  // Função para calcular mensalidade com desconto
  const calculateMonthlyFeeWithDiscount = (originalFee: number, discountPercentage: number) => {
    const discountMultiplier = 1 - (discountPercentage / 100);
    return originalFee * discountMultiplier;
  };

  // Carregar filtros quando o perfil estiver disponível (evita carregar entrevistadores de todas as unidades antes do perfil)
  useEffect(() => {
    if (profile?.unit_id) {
      fetchFiltersData();
    }
  }, [profile?.unit_id]);

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

  useEffect(() => {
    if (!onTodayCountChange) return;
    const todayStr = getCurrentDate();
    const selectedStr = dateToLocalString(selectedDate);
    if (selectedStr === todayStr) {
      onTodayCountChange(filteredAppointments.length);
    }
  }, [filteredAppointments, selectedDate, onTodayCountChange]);
  
  // Log filtered appointments whenever they change
  useEffect(() => {
    console.log('Filtered appointments updated:', filteredAppointments);
  }, [filteredAppointments]);

  const fetchFiltersData = async () => {
    setFiltersLoading(true);
    try {
      // Construir query de entrevistadores: apenas ativos, roles elegíveis
      let interviewersQuery = supabase
        .from('staff_directory')
        .select('*')
        .in('profile', ['entrevistador', 'direcao', 'admin'])
        .eq('ativo', true);

      if (!fullAccess) {
        if (allowedUnitIds.length > 0) {
          interviewersQuery = interviewersQuery.in('unit_id', allowedUnitIds);
        } else if (profile?.unit_id) {
          interviewersQuery = interviewersQuery.eq('unit_id', profile.unit_id);
        }
      }

      const [unitsData, seriesData, interviewersData] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        supabase.from('series').select('*').order('ordenar', { ascending: true }),
        interviewersQuery.order('name')
      ]);

      if (unitsData.error) throw unitsData.error;
      if (seriesData.error) throw seriesData.error;
      if (interviewersData.error) throw interviewersData.error;

      setUnits(unitsData.data || []);
      setSeries(seriesData.data || []);
      // Sanitize entrevistadores para evitar itens nulos e manter apenas válidos
      const sanitizedInterviewers = (interviewersData.data || []).filter((p) => p?.id);
      setInterviewers(sanitizedInterviewers);
      
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
    // Usar data local para evitar problemas de timezone
    const dateStr = dateToLocalString(selectedDate);
    
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
          profiles!appointments_interviewer_id_fkey(name)
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
    } else if (filters.segment && filters.segment !== 'all') {
      const seriesIdsInSegment = getSeriesIdsForSegment(series, filters.segment);
      filtered = filtered.filter(apt =>
        seriesIdsInSegment.includes(apt.students?.classes?.series_id ?? '')
      );
      console.log('After segment filter:', filtered.length);
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
      // Usar data local para evitar problemas de timezone
      const dateStr = dateToLocalString(date);
      console.log('Formatted date for API:', dateStr);
      onDateSelect?.(dateStr);
    }
  };

  const handleOpenAttendanceModal = (appointment: Appointment) => {
    // Verificar se o usuário pode realizar atendimentos
    if (profile?.profile === 'padrao') {
      toast.error('Usuários com perfil "Padrão" não podem realizar atendimentos. Entre em contato com um administrador.');
      return;
    }

    setCurrentAppointment(appointment);
    setAttendanceDiscount('');
    setAttendanceComments('');
    setMaterialPaymentType('');
    setMaterialInstallments(2);
    setTuitionInstallments(appointment?.students?.classes?.parcelas || 12);
    setShowAttendanceModal(true);
  };

  const handleRegisterAttendance = async () => {
    if (!currentAppointment) return;
    
    // Verificação de segurança: usuários padrão não podem realizar atendimentos
    if (profile?.profile === 'padrao') {
      toast.error('Usuários com perfil "Padrão" não podem realizar atendimentos. Entre em contato com um administrador.');
      return;
    }
    
    if (!attendanceDiscount) {
      toast.error('Preencha o percentual de desconto');
      return;
    }


    const discount = parseFloat(attendanceDiscount);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast.error('Percentual de desconto deve estar entre 0% e 100%');
      return;
    }

    // Calcular desconto do material baseado no tipo de pagamento (0% se não houver)
    const materialDiscountSelected = materialPaymentType === 'a_vista' ? 10 : 
                                    materialPaymentType === 'parcelado_cartao' ? 5 : 0;

    // Calcular valor da parcela do material (padrão 12x sem desconto quando não houver seleção)
    const materialAnual = currentAppointment?.students?.classes?.material_didatico_anual || 0;
    const effectiveInstallments = materialPaymentType ? materialInstallments : 12;
    const effectiveDiscount = materialPaymentType ? materialDiscountSelected : 0;
    const materialComDesconto = materialAnual * (1 - (effectiveDiscount / 100));
    const materialParcelaCalc = materialComDesconto / Math.max(1, effectiveInstallments);

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

      // Update student's discount_percentage, material info and status
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({ 
          discount_percentage: discount,
          discount_material: effectiveDiscount,
          material_payment_type: materialPaymentType || null,
          material_installments: materialPaymentType ? effectiveInstallments : null,
          material_parcela: materialPaymentType ? materialParcelaCalc : null,
          status: 'atendimento_recentemente'
        })
        .eq('id', currentAppointment.student_id);

      if (studentUpdateError) throw studentUpdateError;

      // Add interaction
      const paymentTypeText = materialPaymentType === 'a_vista' ? 'À Vista' : 
                              materialPaymentType === 'parcelado_cartao' ? `Cartão ${materialInstallments}x` : 
                              materialPaymentType === 'parcelado_boleto' ? `Boleto ${materialInstallments}x` :
                              'Sem forma de pagamento definida';

      const annuityOriginal = currentAppointment?.students?.classes?.annuity ?? (
        (currentAppointment?.students?.classes?.monthly_fee || 0) * (currentAppointment?.students?.classes?.parcelas || 12)
      );
      const monthlyFeeDiscounted = (
        annuityOriginal * (1 - (discount / 100))
      ) / Math.max(1, tuitionInstallments);

      const { error: interactionError } = await supabase
        .from('student_interactions')
        .insert({
          student_id: currentAppointment.student_id,
          user_id: profile?.id,
          interaction_type: 'atendimento',
          comments: `Atendimento realizado. Mensalidade negociada: ${discount}% de desconto em ${tuitionInstallments}x. Material: ${paymentTypeText} (${effectiveDiscount}% desconto). ${attendanceComments.trim() || 'Sem comentários.'}`
        });

      if (interactionError) throw interactionError;

      toast.success('Atendimento registrado com sucesso');
      setShowAttendanceModal(false);
      setCurrentAppointment(null);
      setAttendanceDiscount('');
      setAttendanceComments('');
      setMaterialPaymentType('');
      setMaterialInstallments(2);
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

  const handleCancelAppointment = async (appointmentId: string) => {
    const appointmentToCancel = appointments.find(apt => apt.id === appointmentId);
    if (!appointmentToCancel) {
      console.error('Appointment not found for cancellation:', appointmentId);
      toast.error('Agendamento não encontrado.');
      return;
    }

    // Confirmar cancelamento
    if (!confirm(`Tem certeza que deseja cancelar a entrevista de ${appointmentToCancel.students?.student_name}?`)) {
      return;
    }

    try {
      // Deletar o agendamento da tabela appointments
      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (deleteError) throw deleteError;

      // Atualizar o status do aluno para 'nenhum_agendamento' e limpar a data da entrevista
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({ 
          status: 'nenhum_agendamento',
          interview_date: null
        })
        .eq('id', appointmentToCancel.student_id);

      if (studentUpdateError) throw studentUpdateError;

      // Registrar interação documentando o cancelamento
      const { error: interactionError } = await supabase
        .from('student_interactions')
        .insert({
          student_id: appointmentToCancel.student_id,
          user_id: profile?.id,
          interaction_type: 'mudanca_status',
          comments: `Entrevista cancelada. Status alterado para "Nenhum Agendamento". Entrevista estava agendada para ${formatDateForDisplay(appointmentToCancel.appointment_date)} às ${formatTimeForDisplay(appointmentToCancel.appointment_time)}.`
        });

      if (interactionError) {
        console.error('Error inserting interaction:', interactionError);
        // Não falha a operação se não conseguir registrar a interação
      }

      toast.success('Entrevista cancelada com sucesso');
      // Recarrega os dados para garantir sincronização
      fetchAppointments();
    } catch (error) {
      console.error('Error canceling appointment:', error);
      toast.error('Erro ao cancelar entrevista');
      // Recarrega os dados em caso de erro para restaurar o estado correto
      fetchAppointments();
    }
  };

  const getStatusBadge = (status: string, attended: boolean, studentStatus?: string) => {
    // Se o aluno já foi atendido recentemente, mostrar como realizado
    if (studentStatus === 'atendimento_recentemente') {
      return <Badge className="bg-green-500">Realizado</Badge>;
    }
    
    switch (status) {
      case 'agendado':
      case 'scheduled':
        return (
          <Badge className="gap-1.5 border-0 bg-blue-50 font-medium text-primary hover:bg-blue-50">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Agendado
          </Badge>
        );
      case 'cancelado':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'faltou':
        return <Badge variant="destructive">Faltou</Badge>;
      case 'realizado':
        return <Badge className="bg-green-500">Realizado</Badge>;
      default:
        return <Badge variant="outline">{status || 'Pendente'}</Badge>;
    }
  };

  const accentBar = <div className="absolute left-0 top-0 h-full w-1.5 bg-primary" />;

  const calendarClassNames = {
    months: 'flex w-full flex-col',
    month: 'w-full space-y-5',
    caption: 'relative mb-2 flex items-center justify-center pt-1',
    caption_label: 'text-lg font-semibold text-gray-900',
    nav: 'flex items-center space-x-1',
    nav_button: cn(
      buttonVariants({ variant: 'outline' }),
      'h-9 w-9 rounded-lg border-gray-200 bg-transparent p-0 opacity-80 hover:opacity-100'
    ),
    nav_button_previous: 'absolute left-0',
    nav_button_next: 'absolute right-0',
    table: 'w-full border-collapse',
    head_row: 'mb-2 flex w-full',
    head_cell: 'flex-1 text-center text-sm font-medium capitalize text-muted-foreground',
    row: 'mt-1 flex w-full',
    cell: 'relative flex-1 p-1 text-center',
    day: cn(
      buttonVariants({ variant: 'ghost' }),
      'mx-auto h-11 w-11 rounded-lg p-0 text-base font-medium aria-selected:opacity-100'
    ),
    day_selected:
      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
    day_today: 'font-semibold text-primary',
    day_outside: 'text-muted-foreground opacity-40',
  };

  const filtersPanel = (
    <Card className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {accentBar}
      <CardHeader className="border-b border-gray-100 pb-3 pl-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-5 w-5 shrink-0 text-primary" />
          <span>Filtros</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pl-5 pt-4">
        {filtersLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-gray-700">Unidade</label>
              <Select value={filters.unit} onValueChange={(value) => setFilters(prev => ({ ...prev, unit: value }))}>
                <SelectTrigger className="mt-1 rounded-xl border-gray-200 bg-white shadow-sm">
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Segmento</label>
              <Select value={filters.segment} onValueChange={handleSegmentChange}>
                <SelectTrigger className="mt-1 rounded-xl border-gray-200 bg-white shadow-sm">
                  <SelectValue placeholder="Todos os segmentos" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="all">Todos os segmentos</SelectItem>
                  {availableSegments.map((level) => (
                    <SelectItem key={level} value={level}>
                      {getSegmentLabel(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Série</label>
              <Select value={filters.series} onValueChange={(value) => setFilters(prev => ({ ...prev, series: value }))}>
                <SelectTrigger className="mt-1 rounded-xl border-gray-200 bg-white shadow-sm">
                  <SelectValue placeholder="Todas as séries" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="all">Todas as séries</SelectItem>
                  {filteredSeriesOptions.map(serie => (
                    <SelectItem key={serie.id} value={serie.id}>{serie.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Entrevistador</label>
              <Select value={filters.interviewer} onValueChange={(value) => setFilters(prev => ({ ...prev, interviewer: value }))}>
                <SelectTrigger className="mt-1 rounded-xl border-gray-200 bg-white shadow-sm">
                  <SelectValue placeholder="Todos os entrevistadores" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="all">Todos os entrevistadores</SelectItem>
                  {interviewers.map(interviewer => (
                    <SelectItem key={interviewer.id} value={interviewer.id}>{interviewer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setFilters({ unit: 'all', segment: 'all', series: 'all', interviewer: 'all' })}
              variant="outline"
              className="w-full rounded-xl border-gray-200"
            >
              Limpar Filtros
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {view === 'full' && (
        <section id="calendar" className="scroll-mt-20">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-8">
            {accentBar}
            <CardHeader className="border-b border-gray-100 pb-3 pl-5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary">
                <CalendarIcon className="h-5 w-5 shrink-0 text-primary" />
                <span>Calendário de Agendamentos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-5 pt-5">
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Selecionar Data
              </p>
              {loading && appointments.length === 0 ? (
                <div className="flex h-80 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  className="w-full max-w-none rounded-xl border-2 border-primary/25 p-4 md:p-6"
                  classNames={calendarClassNames}
                  initialFocus
                  today={today}
                />
              )}
            </CardContent>
          </Card>

          <div className="xl:col-span-4">{filtersPanel}</div>
        </div>
        </section>
      )}

      {view === 'list' && (
        <section id="calendar" className="scroll-mt-20">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-8">
            {accentBar}
            <CardHeader className="border-b border-gray-100 pb-3 pl-5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary">
                <CalendarIcon className="h-5 w-5 shrink-0 text-primary" />
                <span>Selecionar Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-5 pt-5">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="w-full max-w-none rounded-xl border-2 border-primary/25 p-4 md:p-6"
                classNames={calendarClassNames}
                initialFocus
                today={today}
              />
            </CardContent>
          </Card>
          <div className="xl:col-span-4">{filtersPanel}</div>
        </div>
        </section>
      )}

      <section id="list" className="scroll-mt-20">
      <Card className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {accentBar}
        <CardHeader className="border-b border-gray-100 pb-3 pl-5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary">
            <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
            <span>Agendamentos para {formatDateForDisplay(dateToLocalString(selectedDate))}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-5 pt-4">
          {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Carregando agendamentos...</span>
              </div>
            ) : filteredAppointments && filteredAppointments.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredAppointments.map((appointment) => (
                <div key={appointment.id} className="space-y-3 py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-base font-semibold">
                          {appointment.appointment_time ? formatTimeForDisplay(appointment.appointment_time) : 'Horário não definido'}
                        </span>
                      </div>
                      {getStatusBadge(appointment.status || '', appointment.attended || false, appointment.students?.status)}
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row sm:justify-end">
                      {appointment.status !== 'realizado' && 
                       appointment.status !== 'faltou' && 
                       appointment.students?.status !== 'atendimento_recentemente' && ( 
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id, 'faltou')}
                            variant="outline"
                            className="w-full border-red-300 text-red-600 hover:bg-red-50 sm:w-auto"
                            disabled={loading}
                          >
                            Marcar Falta
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenAttendanceModal(appointment)}
                            className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
                            disabled={loading || profile?.profile === 'padrao'}
                            title={profile?.profile === 'padrao' ? 'Usuários com perfil "Padrão" não podem realizar atendimentos' : 'Registrar atendimento'}
                          >
                            Atender
                          </Button>
                        </>
                      )}
                      {/* Botão de cancelar - disponível para agendamentos não realizados */}
                      {appointment.status !== 'realizado' && 
                       appointment.status !== 'faltou' && (
                        <Button
                          size="sm"
                          onClick={() => handleCancelAppointment(appointment.id)}
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
                          disabled={loading}
                          title="Cancelar entrevista"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="font-medium text-gray-900">Aluno:</span>
                      <span>{appointment.students?.student_name || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="font-medium text-gray-900">Unidade:</span>
                      <span>
                        {appointment.students?.classes?.units?.name ||
                         appointment.unit?.name ||
                         'Não informada'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="font-medium text-gray-900">Série:</span>
                      <span>
                        {appointment.students?.classes?.series?.name ||
                         appointment.series?.name ||
                         'Não informada'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-900">Entrevistador: </span>
                      <span className="text-gray-700">
                        {appointment.profiles?.name ||
                         appointment.interviewer?.name ||
                         'Não informado'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Formato:</span>
                      <Badge
                        variant="outline"
                        className="border-gray-200 bg-gray-50 font-normal text-gray-700"
                      >
                        {appointment.formato_entrevista === 'a_distancia' ? 'A Distância' : 'Presencial'}
                      </Badge>
                    </div>
                  </div>

                  {appointment.comments && (
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">Comentários:</span> {appointment.comments}
                    </div>
                  )}

                  {appointment.discount_percentage ? (
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">Desconto:</span> {appointment.discount_percentage}%
                    </div>
                  ) : null}
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
      </section>

      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base">Registrar Atendimento</DialogTitle>
            <DialogDescription className="text-xs">
              {currentAppointment?.students?.student_name}
            </DialogDescription>
          </DialogHeader>
          
          {/* Verificação de permissão no modal */}
          {profile?.profile === 'padrao' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-1 mb-1 text-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-3 w-3 text-red-600 flex-shrink-0" />
                <p className="text-red-700">
                  Usuários com perfil "Padrão" não podem realizar atendimentos.
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            {/* Grid de 2 colunas para informações principais */}
            <div className="grid grid-cols-2 gap-2">
              {/* Informações da Mensalidade */}
              <div className="border rounded-lg p-2">
                <div className="flex items-center space-x-1 mb-1">
                  <DollarSign className="h-3 w-3 text-green-600" />
                  <span className="font-medium text-xs">Mensalidade</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-600">Valor Original:</span>
                      <span className="font-semibold text-xs">
                        R$ {currentAppointment?.students?.classes?.monthly_fee?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label htmlFor="discount" className="text-xs">Desconto (%)</label>
                      <Input
                        id="discount"
                        type="number"
                        min="0"
                        max="100"
                        value={attendanceDiscount}
                        onChange={(e) => setAttendanceDiscount(e.target.value)}
                        className="text-xs h-7"
                        placeholder="Ex: 10"
                      />
                    </div>
                    <div className="flex flex-col space-y-1 mt-1">
                      <label htmlFor="tuition-installments" className="text-xs">Parcelas da Anuidade</label>
                      <Input
                        id="tuition-installments"
                        type="number"
                        min="1"
                        max="12"
                        value={tuitionInstallments}
                        onChange={(e) => setTuitionInstallments(Math.max(1, parseInt(e.target.value || '1')))}
                        className="text-xs h-7"
                        placeholder="Ex: 12"
                      />
                    </div>
                  </div>

                  {attendanceDiscount && !isNaN(parseFloat(attendanceDiscount)) && (
                    <div className="bg-green-50 p-1.5 rounded-lg border border-green-200 text-xs">
                      <div className="flex justify-between mt-1">
                        <span>Anuidade com desconto:</span>
                        <span className="text-green-700 font-semibold">
                          R$ {(
                            (currentAppointment?.students?.classes?.annuity ?? (
                              (currentAppointment?.students?.classes?.monthly_fee || 0) * (currentAppointment?.students?.classes?.parcelas || 12)
                            )) * (1 - (parseFloat(attendanceDiscount) / 100))
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Parcelas:</span>
                        <span className="text-green-700 font-semibold">
                          {tuitionInstallments}x de R$ {(
                            (
                              (
                                (currentAppointment?.students?.classes?.annuity ?? (
                                  (currentAppointment?.students?.classes?.monthly_fee || 0) * (currentAppointment?.students?.classes?.parcelas || 12)
                                )) * (1 - (parseFloat(attendanceDiscount) / 100))
                              )
                            ) / Math.max(1, tuitionInstallments)
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Material Didático */}
              <div className="border rounded-lg p-2">
                <div className="flex items-center space-x-1 mb-1">
                  <GraduationCap className="h-3 w-3 text-purple-600" />
                  <span className="font-medium text-xs">Material Didático</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-600">Valor Anual:</span>
                    <span className="font-semibold text-xs">
                      R$ {currentAppointment?.students?.classes?.material_didatico_anual?.toFixed(2) || '0.00'}
                    </span>
                  </div>

                  {!materialPaymentType && (
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-600">Parcela (12x):</span>
                      <span className="font-semibold text-xs text-purple-700">
                        R$ {(((currentAppointment?.students?.classes?.material_didatico_anual || 0) / 12)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <MaterialPaymentSelector
                    paymentType={materialPaymentType}
                    onPaymentTypeChange={setMaterialPaymentType}
                    installments={materialInstallments}
                    onInstallmentsChange={setMaterialInstallments}
                    compact={true}
                  />
                </div>
              </div>
            </div>

            {/* Calculadora de Material Didático */}
            {materialPaymentType && currentAppointment?.students?.classes && (
              <div className="border rounded-lg p-1.5">
                <MaterialDidaticoCalculator
                  materialAnual={currentAppointment.students.classes.material_didatico_anual || 0}
                  materialMensal={currentAppointment.students.classes.material_didatico_mes || 0}
                  discountMaterial={materialPaymentType === 'a_vista' ? 10 : 
                                  materialPaymentType === 'parcelado_cartao' ? 5 : 0}
                  hasHadInterview={true}
                  paymentType={materialPaymentType}
                  installments={materialInstallments}
                  compact={true}
                />
              </div>
            )}

            {/* Comentários */}
            <div className="flex flex-col space-y-1">
              <label htmlFor="comments" className="text-xs">Comentários</label>
              <Textarea
                id="comments"
                value={attendanceComments}
                onChange={(e) => setAttendanceComments(e.target.value)}
                className="h-12 text-xs resize-none"
                placeholder="Observações sobre o atendimento..."
              />
            </div>
          </div>
          <DialogFooter className="pt-1">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowAttendanceModal(false)}>Cancelar</Button>
            <Button 
              size="sm"
              className="h-8 text-xs bg-green-600 hover:bg-green-700"
              onClick={handleRegisterAttendance}
              disabled={profile?.profile === 'padrao'}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppointmentCalendar;
