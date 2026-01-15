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
  onSuccess: (appointment: any) => void;
  unitAddress?: string;
  unitName?: string;
  fallback?: React.ReactNode;
}

type Availability = Tables<'interviewer_availability'> & {
  profiles: Tables<'profiles'>;
};

export const SelfScheduling = ({ 
  unitId, 
  classId, 
  studentId, 
  onSuccess,
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

  useEffect(() => {
    fetchAvailabilities();
  }, [unitId, classId]);

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
        const { data, error } = await supabase
          .from('appointments')
          .select('interviewer_id, appointment_time')
          .eq('appointment_date', dateStr)
          .in('interviewer_id', interviewerIds);

        if (error) {
          console.error('Erro ao buscar agendamentos existentes:', error);
          setBookedSlots({});
          return;
        }

        const map: Record<string, string[]> = {};

        console.log('🗓️ Agendamentos encontrados para a data:', data?.length);

        (data || []).forEach((appt: any) => {
          if (!appt.interviewer_id || !appt.appointment_time) return;
          
          // Normalizar horário para HH:mm (banco pode retornar HH:mm:ss)
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
        .select(`
          *,
          profiles!interviewer_availability_interviewer_id_fkey(*)
        `)
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

      // 2. Create Appointment
      const { data: appointment, error: appError } = await supabase
        .from('appointments')
        .insert({
          student_id: studentId,
          interviewer_id: randomInterviewerId,
          appointment_date: dateStr,
          appointment_time: selectedSlot.time,
          status: 'scheduled',
          formato_entrevista: 'presencial' // Default
        })
        .select()
        .single();

      if (appError) throw appError;

      // 3. Update Student Status and Interview Date
      const { error: studentError } = await supabase
        .from('students')
        .update({ 
          status: 'atendimento_agendado',
          interview_date: dateStr // Saving the interview date
        })
        .eq('id', studentId);

      if (studentError) console.error('Error updating student status:', studentError);

      toast.success('Agendamento realizado com sucesso!');
      
      onSuccess({
        date: dateStr,
        time: selectedSlot.time,
        unitName,
        unitAddress
      });

    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error('Erro ao realizar agendamento. Tente novamente.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (availabilities.length === 0) {
    return <>{fallback}</>;
  }

  const slots = selectedDate ? getSlotsForDate(selectedDate) : [];

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-6">
      <Card className="border-none shadow-none md:border md:shadow-sm">
        <CardHeader className="px-0 md:px-6">
          <CardTitle className="text-lg">Escolha uma data</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 flex justify-center">
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
            className="rounded-md border shadow-sm bg-white"
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
        <div className="md:col-span-2 flex justify-end mt-4">
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
  );
};
