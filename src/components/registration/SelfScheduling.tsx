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
import { isAppointmentSlotAvailableForDate } from '@/utils/dateUtils';

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
  const [specificAvailabilities, setSpecificAvailabilities] = useState<any[]>([]);
  const [recurrentAvailabilities, setRecurrentAvailabilities] = useState<any[]>([]);
  const [exclusions, setExclusions] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
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

  // Helper to fetch all availability data sources
  const fetchAvailabilities = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch specific availabilities (one-off)
      const { data: specificData, error: specificErr } = await supabase
        .from('interviewer_availability')
        .select('*')
        .gte('date', today);
      if (specificErr) throw specificErr;

      // 2. Fetch recurrent availabilities
      const { data: recurrentData, error: recurrentErr } = await supabase
        .from('interviewer_recurrent_availability' as any)
        .select('*');
      if (recurrentErr) throw recurrentErr;

      // 3. Fetch exclusions
      const { data: exclusionData, error: exclusionErr } = await supabase
        .from('availability_exclusions' as any)
        .select('*')
        .gte('exclusion_date', today);
      if (exclusionErr) throw exclusionErr;

      setSpecificAvailabilities(specificData || []);
      setRecurrentAvailabilities(recurrentData || []);
      setExclusions(exclusionData || []);

      // Calculate available dates for calendar (next 90 days)
      const candidateDates: Date[] = [];
      const base = startOfToday();
      for (let i = 0; i < 90; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        candidateDates.push(d);
      }

      const datesWithSlots = candidateDates.filter(date => {
        return getSlotsForDateLocal(date, specificData || [], recurrentData || [], exclusionData || []).length > 0;
      });

      setAvailableDates(datesWithSlots);
      if (onAvailabilitiesLoaded) {
        onAvailabilitiesLoaded(datesWithSlots.length > 0);
      }
    } catch (error) {
      console.error('Error fetching availabilities:', error);
      toast.error('Erro ao carregar horários disponíveis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBookedSlotsForDate = async () => {
      if (!selectedDate) {
        setBookedSlots({});
        return;
      }

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const slots = getSlotsForDateLocal(selectedDate, specificAvailabilities, recurrentAvailabilities, exclusions);
      
      const interviewerIds = Array.from(
        new Set(
          slots.flatMap(s => s.interviewers)
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
        (data || []).forEach((appt: { interviewer_id: string; appointment_time: string }) => {
          if (!appt.interviewer_id || !appt.appointment_time) return;
          const time = appt.appointment_time.substring(0, 5);
          const existing = map[time] || [];
          existing.push(appt.interviewer_id);
          map[time] = existing;
        });

        setBookedSlots(map);
      } catch (error) {
        console.error('Erro ao carregar agendamentos existentes:', error);
        setBookedSlots({});
      }
    };

    fetchBookedSlotsForDate();
  }, [selectedDate, specificAvailabilities, recurrentAvailabilities, exclusions]);

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

  // Helper to determine matches on Unit and Class
  const matchesUnitAndClass = (avail: any) => {
    const unitMatch = !avail.unit_id || avail.unit_id === unitId;
    let hasClassIds = false;
    let includesClass = false;

    if (avail.class_ids) {
      if (Array.isArray(avail.class_ids)) {
        hasClassIds = avail.class_ids.length > 0;
        includesClass = avail.class_ids.includes(classId);
      } else if (typeof avail.class_ids === 'string') {
        const cleanIds = (avail.class_ids as string).replace(/[{}]/g, '').split(',');
        hasClassIds = cleanIds.length > 0 && cleanIds[0] !== '';
        includesClass = cleanIds.includes(classId);
      }
    }

    const classMatch = !hasClassIds || includesClass;
    return unitMatch && classMatch;
  };

  // Logic to calculate slots for a date without booked slots (used for calendar dates calculation)
  const getSlotsForDateLocal = (
    date: Date,
    specialsList: any[],
    recurrentsList: any[],
    exclusionsList: any[]
  ) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

    // 1. Get exclusions for this date and unit
    const activeExclusions = exclusionsList.filter(ex => {
      const matchDate = ex.exclusion_date === dateStr;
      const matchUnit = !ex.unit_id || ex.unit_id === unitId;
      return matchDate && matchUnit;
    });

    // 2. Get specific availabilities for this date
    const daySpecials = specialsList.filter(a => a.date === dateStr && matchesUnitAndClass(a));

    // 3. Get recurrent availabilities for this weekday
    const dayRecurrents = recurrentsList.filter(a => a.day_of_week === dayOfWeek && matchesUnitAndClass(a));

    // Find all interviewers involved
    const interviewers = Array.from(
      new Set([
        ...daySpecials.map(a => a.interviewer_id),
        ...dayRecurrents.map(a => a.interviewer_id)
      ])
    );

    const slotsMap = new Map<string, string[]>(); // Time -> InterviewerIDs[]

    interviewers.forEach(interviewerId => {
      // Rule: Specific availability overrides recurrent availability
      const hasSpecific = daySpecials.some(a => a.interviewer_id === interviewerId);
      const activeAvailabilities = hasSpecific
        ? daySpecials.filter(a => a.interviewer_id === interviewerId)
        : dayRecurrents.filter(a => a.interviewer_id === interviewerId);

      activeAvailabilities.forEach(avail => {
        const slots = generateSlots(avail.start_time, avail.end_time);
        slots.forEach(time => {
          // Check exclusion rules for this interviewer and slot
          const isExcluded = activeExclusions.some(ex => {
            const matchInterviewer = !ex.interviewer_id || ex.interviewer_id === interviewerId;
            if (!matchInterviewer) return false;
            
            // If all day, it is excluded
            if (!ex.start_time || !ex.end_time) return true;
            
            // Time range check
            return time >= ex.start_time.substring(0, 5) && time < ex.end_time.substring(0, 5);
          });

          if (!isExcluded) {
            const existing = slotsMap.get(time) || [];
            existing.push(interviewerId);
            slotsMap.set(time, existing);
          }
        });
      });
    });

    return Array.from(slotsMap.entries())
      .map(([time, interviewerIds]) => ({ time, interviewers: interviewerIds }))
      .filter(slot => slot.interviewers.length > 0)
      .filter(slot => isAppointmentSlotAvailableForDate(slot.time, date));
  };

  const getSlotsForDate = (date: Date) => {
    const rawSlots = getSlotsForDateLocal(date, specificAvailabilities, recurrentAvailabilities, exclusions);
    
    return rawSlots
      .map(slot => {
        const bookedForTime = bookedSlots[slot.time] || [];
        const availableInterviewers = slot.interviewers.filter(
          id => !bookedForTime.includes(id)
        );
        return { time: slot.time, interviewers: availableInterviewers };
      })
      .filter(slot => slot.interviewers.length > 0)
      .sort((a, b) => a.time.localeCompare(b.time));
  };


  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot) return;

    if (!isAppointmentSlotAvailableForDate(selectedSlot.time, selectedDate)) {
      toast.error('Este horário já passou. Escolha outro horário disponível.');
      return;
    }

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

  if (availableDates.length === 0) {
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
