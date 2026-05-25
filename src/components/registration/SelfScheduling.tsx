import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Clock, Calendar as CalendarIcon, MapPin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isSameDay, addMinutes, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

interface SelfSchedulingProps {
  unitId: string;
  classId: string;
  studentId: string;
  registrationToken: string;
  onSuccess: (appointment: any) => void;
  onAvailabilitiesLoaded?: (hasAvailabilities: boolean) => void;
  unitAddress?: string;
  unitName?: string;
  fallback?: React.ReactNode;
}

type Availability = Tables<'interviewer_availability'>;

export const SelfScheduling = ({
  unitId,
  classId,
  studentId,
  registrationToken,
  onSuccess,
  onAvailabilitiesLoaded,
  unitAddress,
  unitName,
  fallback
}: SelfSchedulingProps) => {
  const [loading, setLoading] = useState(true);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<{ time: string, interviewers: string[] } | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  const [hasExistingAppointment, setHasExistingAppointment] = useState(false);
  const [checkingAppointment, setCheckingAppointment] = useState(true);

  useEffect(() => {
    checkExistingAppointment();
  }, [studentId, registrationToken]);

  useEffect(() => {
    if (!hasExistingAppointment) {
      fetchAvailabilities();
    }
  }, [unitId, classId, hasExistingAppointment]);

  const checkExistingAppointment = async () => {
    setCheckingAppointment(true);
    try {
      const { data, error } = await supabase.rpc('get_my_appointment', {
        p_student_id: studentId,
        p_registration_token: registrationToken,
      });

      if (error) {
        console.error('Erro ao verificar agendamento existente:', error);
        setHasExistingAppointment(false);
        return;
      }

      const result = data as {
        success?: boolean;
        has_appointment?: boolean;
        error?: string;
      };

      if (!result?.success) {
        console.error('Token inválido ao verificar agendamento:', result?.error);
        setHasExistingAppointment(false);
        return;
      }

      if (result.has_appointment) {
        setHasExistingAppointment(true);
        setLoading(false);
      } else {
        setHasExistingAppointment(false);
      }
    } catch (error) {
      console.error('Erro ao verificar agendamento existente:', error);
      setHasExistingAppointment(false);
    } finally {
      setCheckingAppointment(false);
    }
  };

  useEffect(() => {
    const fetchBookedSlotsForDate = async () => {
      if (!selectedDate) {
        setBookedSlots({});
        return;
      }

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const dayAvails = availabilities.filter(a => a.date === dateStr);

      const interviewerIds = Array.from(
        new Set(
          dayAvails
            .map(a => a.interviewer_id)
            .filter((id): id is string => !!id)
        )
      );

      if (interviewerIds.length === 0) {
        setBookedSlots({});
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_occupied_slots', {
          p_date: dateStr,
          p_interviewer_ids: interviewerIds,
        });

        if (error) {
          console.error('Erro ao buscar agendamentos existentes:', error);
          setBookedSlots({});
          return;
        }

        const map: Record<string, string[]> = {};

        console.log('🗓️ Agendamentos encontrados para a data:', data?.length);

        (data || []).forEach((appt: { interviewer_id: string; appointment_time: string }) => {
          if (!appt.interviewer_id || !appt.appointment_time) return;

          const time = appt.appointment_time.substring(0, 5);

          const existing = map[time] || [];
          existing.push(appt.interviewer_id);
          map[time] = existing;
          console.log(`🔒 Bloqueado: ${time} - Entrevistador: ${appt.interviewer_id}`);
        });

        setBookedSlots(map);
      } catch (error) {
        console.error('Erro ao carregar agendamentos existentes:', error);
        setBookedSlots({});
      }
    };

    fetchBookedSlotsForDate();
  }, [selectedDate, availabilities]);

  const fetchAvailabilities = async () => {
    setLoading(true);
    try {
      // Usar data local para evitar problemas de fuso horário (UTC vs Local)
      const today = format(new Date(), 'yyyy-MM-dd');
      console.log('📅 Buscando disponibilidades a partir de:', today);
      console.log('🔍 Filtros - Unit:', unitId, 'Class:', classId);

      // Fetch availabilities
      // Note: We need to filter client-side for class_ids array contains logic 
      // if we can't do it easily in PostgREST without complex filters
      const { data, error } = await supabase
        .from('interviewer_availability')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) throw error;

      console.log('📥 Disponibilidades brutas:', data?.length);

      // Filter locally for Unit and Class logic
      const filtered = (data || []).filter((avail: any) => {
        // Filter by Unit: Match specific unit OR Global (null)
        const unitMatch = !avail.unit_id || avail.unit_id === unitId;

        // Filter by Class: Empty array (all classes) OR contains specific class
        // Tratamento robusto para class_ids (caso venha null, array vazio ou string)
        let hasClassIds = false;
        let includesClass = false;

        if (avail.class_ids) {
          if (Array.isArray(avail.class_ids)) {
            hasClassIds = avail.class_ids.length > 0;
            includesClass = avail.class_ids.includes(classId);
          } else if (typeof avail.class_ids === 'string') {
            // Fallback caso venha como string do Postgres
            // O formato seria "{uuid,uuid}"
            const cleanIds = (avail.class_ids as string).replace(/[{}]/g, '').split(',');
            hasClassIds = cleanIds.length > 0 && cleanIds[0] !== '';
            includesClass = cleanIds.includes(classId);
          }
        }

        const classMatch = !hasClassIds || includesClass;

        if (!unitMatch || !classMatch) {
          console.log(`❌ Filtrado: ID ${avail.id} - UnitMatch: ${unitMatch}, ClassMatch: ${classMatch}`);
        }

        return unitMatch && classMatch;
      });

      console.log('✅ Disponibilidades filtradas:', filtered.length);
      setAvailabilities(filtered);
      if (onAvailabilitiesLoaded) {
        onAvailabilitiesLoaded(filtered.length > 0);
      }
    } catch (error) {
      console.error('Error fetching availabilities:', error);
      toast.error('Erro ao carregar horários disponíveis');
    } finally {
      setLoading(false);
    }
  };

  // Generate 30 min slots for a specific availability record
  const generateSlots = (start: string, end: string) => {
    const slots = [];
    let current = parseISO(`2000-01-01T${start}`);
    const endTime = parseISO(`2000-01-01T${end}`);

    while (isBefore(current, endTime)) {
      slots.push(format(current, 'HH:mm'));
      current = addMinutes(current, 30);
    }
    return slots;
  };

  // Group availabilities by Date -> Time Slot -> Interviewers
  const getSlotsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvails = availabilities.filter(a => a.date === dateStr);

    const slotsMap = new Map<string, string[]>(); // Time -> InterviewerIDs[]

    dayAvails.forEach(avail => {
      const slots = generateSlots(avail.start_time, avail.end_time);
      slots.forEach(time => {
        const existing = slotsMap.get(time) || [];
        if (avail.interviewer_id) {
          existing.push(avail.interviewer_id);
        }
        slotsMap.set(time, existing);
      });
    });

    const slotsWithAvailability = Array.from(slotsMap.entries())
      .map(([time, interviewerIds]) => {
        const bookedForTime = bookedSlots[time] || [];
        const availableInterviewers = interviewerIds.filter(
          id => !bookedForTime.includes(id)
        );

        if (bookedForTime.length > 0) {
          console.log(`🕒 Horário ${time}: Total Entrevistadores: ${interviewerIds.length}, Bloqueados: ${bookedForTime.length}, Disponíveis: ${availableInterviewers.length}`);
        }

        return { time, interviewers: availableInterviewers };
      })
      .filter(slot => slot.interviewers.length > 0);

    return slotsWithAvailability.sort((a, b) => a.time.localeCompare(b.time));
  };

  // Get dates that have availability
  const availableDates = availabilities
    .map(a => parseISO(a.date))
    .filter((date, index, self) =>
      index === self.findIndex(d => isSameDay(d, date))
    );

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot) return;

    setBookingLoading(true);
    try {
      // 1. Pick random interviewer
      const randomInterviewerId = selectedSlot.interviewers[
        Math.floor(Math.random() * selectedSlot.interviewers.length)
      ];

      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Verificação final via RPC (inclui validação de token e race condition)
      const { data: existingCheck, error: checkError } = await supabase.rpc('get_my_appointment', {
        p_student_id: studentId,
        p_registration_token: registrationToken,
      });

      if (checkError) throw checkError;

      const checkResult = existingCheck as { success?: boolean; has_appointment?: boolean };
      if (checkResult?.has_appointment) {
        toast.error('Você já possui um agendamento. Não é possível criar outro.');
        setHasExistingAppointment(true);
        return;
      }

      console.log('🔄 Iniciando agendamento via RPC...');
      const { data: result, error: rpcError } = await supabase.rpc('public_schedule_interview', {
        p_student_id: studentId,
        p_interviewer_id: randomInterviewerId,
        p_date: dateStr,
        p_time: selectedSlot.time,
        p_registration_token: registrationToken,
        p_comments: `Agendamento realizado via auto-agendamento. Data: ${format(selectedDate, 'dd/MM/yyyy')}, Hora: ${selectedSlot.time}`
      });

      if (rpcError) {
        console.error('❌ Erro no RPC:', rpcError);
        throw rpcError;
      }

      console.log('✅ Resultado do RPC:', result);

      // Check result success (RPC returns JSONB)
      if (result && (result as any).success === false) {
        throw new Error((result as any).error || 'Erro desconhecido ao agendar');
      }

      toast.success('Agendamento realizado com sucesso!');

      onSuccess({
        date: dateStr,
        time: selectedSlot.time,
        unitName,
        unitAddress
      });

    } catch (error) {
      console.error('Erro detalhado ao agendar (RPC):', error);
      toast.error('Erro ao realizar agendamento. Tente novamente.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (checkingAppointment || loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (hasExistingAppointment) {
    return (
      <div className="mt-4 p-4 border rounded-md bg-yellow-50 dark:bg-yellow-900 text-left">
        <h3 className="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Agendamento já realizado</h3>
        <p className="text-yellow-700 dark:text-yellow-300">
          Você já possui um agendamento de entrevista. Entre em contato conosco se precisar alterar ou cancelar.
        </p>
      </div>
    );
  }

  if (availabilities.length === 0) {
    return <>{fallback}</>;
  }

  const slots = selectedDate ? getSlotsForDate(selectedDate) : [];

  return (
    <>
      <p className="text-sm text-gray-600 text-left mb-4">Escolha o melhor dia e horário para vir conhecer nossa escola.</p>
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <Card className="border-none shadow-none md:border md:shadow-sm">
          <CardHeader className="px-0 md:px-6">
            <CardTitle className="text-lg">Escolha uma data</CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-2 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              disabled={(date) => {
                // Disable dates before today or dates with no availability
                const isBeforeToday = isBefore(date, startOfToday());
                const hasAvailability = availableDates.some(d => isSameDay(d, date));
                return isBeforeToday || !hasAvailability;
              }}
              modifiers={{
                available: availableDates
              }}
              modifiersStyles={{
                available: { fontWeight: 'bold', textDecoration: 'underline', color: 'var(--primary)' }
              }}
              classNames={{
                day_selected: "bg-orange-500 text-white hover:bg-orange-600 hover:text-white focus:bg-orange-500 focus:text-white font-bold"
              }}
              className="rounded-md border shadow-sm bg-white w-full max-w-sm md:max-w-none"
            />
          </CardContent>
        </Card>

        <Card className="border-none shadow-none md:border md:shadow-sm">
          <CardHeader className="px-0 md:px-6">
            <CardTitle className="text-lg">
              {selectedDate
                ? `Horários para ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                : 'Selecione uma data ao lado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6">
            {selectedDate ? (
              slots.length > 0 ? (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="grid grid-cols-2 gap-3">
                    {slots.map(({ time, interviewers }) => (
                      <Button
                        key={time}
                        variant={selectedSlot?.time === time ? "default" : "outline"}
                        className={`w-full justify-center ${selectedSlot?.time === time ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                        onClick={() => setSelectedSlot({ time, interviewers })}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-gray-500 text-center py-8">Não há horários disponíveis nesta data.</p>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <CalendarIcon className="h-12 w-12 mb-2 opacity-20" />
                <p>Escolha um dia para ver os horários</p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedSlot && (
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={handleBooking}
              disabled={bookingLoading}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-lg px-8 py-6 h-auto"
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  Confirmar Agendamento
                  <CheckCircle2 className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};
