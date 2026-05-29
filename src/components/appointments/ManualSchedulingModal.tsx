import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameDay, addMinutes, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Calendar as CalendarIcon, Clock, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAppointmentSlotAvailableForDate } from '@/utils/dateUtils';

interface ManualSchedulingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    unit_id?: string | null;
    class_id?: string | null;
    student_name?: string;
  };
  onSuccess: () => void;
}

type Availability = {
  id: string;
  interviewer_id: string;
  unit_id: string | null;
  class_ids: string[] | null | string; // Pode vir como string do DB se não tipado corretamente
  date: string;
  start_time: string;
  end_time: string;
  profiles: {
    name: string;
  };
};
export function ManualSchedulingModal({ open, onOpenChange, student, onSuccess }: ManualSchedulingModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [modality, setModality] = useState<'presencial' | 'a_distancia'>('presencial');
  const [specificAvailabilities, setSpecificAvailabilities] = useState<any[]>([]);
  const [recurrentAvailabilities, setRecurrentAvailabilities] = useState<any[]>([]);
  const [exclusions, setExclusions] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  const [bookingLoading, setBookingLoading] = useState(false);

  // Fetch availabilities when modal opens
  useEffect(() => {
    if (open && student.unit_id) {
      fetchAvailabilities();
    }
  }, [open, student.unit_id, student.class_id]);

  // Fetch booked slots when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchBookedSlotsForDate();
    } else {
      setBookedSlots({});
    }
  }, [selectedDate, specificAvailabilities, recurrentAvailabilities, exclusions]);

  const fetchAvailabilities = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Fetch specific availabilities
      const { data: specificData, error: specificErr } = await supabase
        .from('interviewer_availability')
        .select(`
          *,
          profiles!interviewer_availability_interviewer_id_fkey(name)
        `)
        .gte('date', today);
      if (specificErr) throw specificErr;

      // 2. Fetch recurrent availabilities
      const { data: recurrentData, error: recurrentErr } = await supabase
        .from('interviewer_recurrent_availability' as any)
        .select(`
          *,
          profiles:interviewer_id(name)
        `);
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
    } catch (error) {
      console.error('Error fetching availabilities:', error);
      toast.error('Erro ao carregar disponibilidades');
    } finally {
      setLoading(false);
    }
  };

  // Helper to determine matches on Unit and Class
  const matchesUnitAndClass = (avail: any) => {
    const unitMatch = !avail.unit_id || avail.unit_id === student.unit_id;
    let hasClassIds = false;
    let includesClass = false;

    if (avail.class_ids) {
      if (Array.isArray(avail.class_ids)) {
        hasClassIds = avail.class_ids.length > 0;
        includesClass = student.class_id ? avail.class_ids.includes(student.class_id) : false;
      } else if (typeof avail.class_ids === 'string') {
        const cleanIds = (avail.class_ids as string).replace(/[{}]/g, '').split(',');
        hasClassIds = cleanIds.length > 0 && cleanIds[0] !== '';
        includesClass = student.class_id ? cleanIds.includes(student.class_id) : false;
      }
    }

    const classMatch = !hasClassIds || includesClass;
    return unitMatch && classMatch;
  };

  const fetchBookedSlotsForDate = async () => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const slots = getSlotsForDateLocal(selectedDate, specificAvailabilities, recurrentAvailabilities, exclusions);
    const interviewerIds = Array.from(new Set(slots.flatMap(s => s.interviewers.map(i => i.id))));

    if (interviewerIds.length === 0) {
        setBookedSlots({});
        return;
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('interviewer_id, appointment_time')
        .eq('appointment_date', dateStr)
        .in('interviewer_id', interviewerIds)
        .neq('status', 'cancelled'); // Ignorar cancelados

      if (error) throw error;

      const map: Record<string, string[]> = {};
      (data || []).forEach((appt: any) => {
        if (!appt.interviewer_id || !appt.appointment_time) return;
        const time = appt.appointment_time.substring(0, 5);
        const existing = map[time] || [];
        existing.push(appt.interviewer_id);
        map[time] = existing;
      });

      setBookedSlots(map);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
    }
  };

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
      const matchUnit = !ex.unit_id || ex.unit_id === student.unit_id;
      return matchDate && matchUnit;
    });

    // 2. Get specific availabilities for this date
    const daySpecials = specialsList.filter(a => a.date === dateStr && matchesUnitAndClass(a));

    // 3. Get recurrent availabilities for this weekday
    const dayRecurrents = recurrentsList.filter(a => a.day_of_week === dayOfWeek && matchesUnitAndClass(a));

    // Find all interviewers involved
    const interviewerIds = Array.from(
      new Set([
        ...daySpecials.map(a => a.interviewer_id),
        ...dayRecurrents.map(a => a.interviewer_id)
      ])
    );

    const slotsMap = new Map<string, { id: string, name: string }[]>(); // Time -> Interviewer[]

    interviewerIds.forEach(interviewerId => {
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
            existing.push({
              id: interviewerId,
              name: avail.profiles?.name || 'Entrevistador'
            });
            slotsMap.set(time, existing);
          }
        });
      });
    });

    return Array.from(slotsMap.entries())
      .map(([time, interviewers]) => ({ time, interviewers }))
      .filter(slot => slot.interviewers.length > 0)
      .filter(slot => isAppointmentSlotAvailableForDate(slot.time, date));
  };

  const getSlotsForDate = (date: Date) => {
    const rawSlots = getSlotsForDateLocal(date, specificAvailabilities, recurrentAvailabilities, exclusions);
    
    return rawSlots
      .map(slot => {
        const bookedForTime = bookedSlots[slot.time] || [];
        const availableInterviewers = slot.interviewers.filter(
          i => !bookedForTime.includes(i.id)
        );
        return { time: slot.time, interviewers: availableInterviewers };
      })
      .filter(slot => slot.interviewers.length > 0)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const handleBooking = async (date: Date, time: string, interviewerId: string) => {
    if (!isAppointmentSlotAvailableForDate(time, date)) {
      toast.error('Este horário já passou. Escolha outro horário disponível.');
      return;
    }

    setBookingLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const formattedDate = format(date, 'dd/MM/yyyy');
      
      // Get interviewer name
      const interviewerName = specificAvailabilities.find(a => a.interviewer_id === interviewerId)?.profiles?.name || 
                              recurrentAvailabilities.find(a => a.interviewer_id === interviewerId)?.profiles?.name || 
                              'Entrevistador';
      const modalityText = modality === 'presencial' ? 'Presencial' : 'A Distância';

      // Create appointment
      const { error } = await supabase
        .from('appointments')
        .insert({
          student_id: student.id,
          interviewer_id: interviewerId,
          appointment_date: dateStr,
          appointment_time: time,
          status: 'scheduled',
          formato_entrevista: modality,
          comments: 'Agendamento manual realizado pelo sistema'
        });

      if (error) throw error;

      // Update student status and interview_date
      const { error: updateError } = await supabase
        .from('students')
        .update({
          status: 'atendimento_agendado',
          interview_date: dateStr
        })
        .eq('id', student.id);
        
      if (updateError) {
        console.error('Erro ao atualizar status do aluno:', updateError);
      }

      // Add interaction
      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          interaction_type: 'agendamento',
          user_id: user?.id,
          comments: `Entrevista agendada para ${formattedDate} às ${time} com ${interviewerName} (${modalityText}). Status automaticamente alterado para "Atendimento Agendado".`
        });

      toast.success('Agendamento realizado com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error booking:', error);
      toast.error('Erro ao realizar agendamento');
    } finally {
      setBookingLoading(false);
    }
  };

  const slots = selectedDate ? getSlotsForDate(selectedDate) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Agendar Entrevista</DialogTitle>
          <DialogDescription>
            Selecione uma data e horário para agendar a entrevista de {student.student_name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
            {!student.unit_id ? (
                <div className="text-center p-8 text-gray-500">
                    O aluno precisa estar vinculado a uma unidade para visualizar os horários disponíveis.
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex justify-center">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            locale={ptBR}
                            disabled={(date) => {
                                const isBeforeToday = isBefore(date, startOfToday());
                                const hasAvailability = availableDates.some(d => isSameDay(d, date));
                                return isBeforeToday || !hasAvailability;
                            }}
                            modifiers={{ available: availableDates }}
                            modifiersStyles={{
                                available: { fontWeight: 'bold', textDecoration: 'underline', color: 'var(--primary)' },
                                selected: { color: 'white', backgroundColor: '#2563eb' }
                            }}
                            classNames={{
                                day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700",
                                day_today: "bg-gray-100 text-gray-900",
                            }}
                            className="rounded-md border shadow-sm"
                        />
                    </div>

                    <Card className="border shadow-sm">
                        <CardContent className="p-4 h-[350px]">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {selectedDate 
                                    ? `Horários em ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}` 
                                    : 'Selecione uma data'}
                            </h3>

                            <div className="mb-4">
                                <Label className="text-sm font-medium mb-2 block">Modalidade</Label>
                                <RadioGroup 
                                    value={modality} 
                                    onValueChange={(v: 'presencial' | 'a_distancia') => setModality(v)}
                                    className="flex space-x-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="presencial" id="presencial" />
                                        <Label htmlFor="presencial">Presencial</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="a_distancia" id="a_distancia" />
                                        <Label htmlFor="a_distancia">A Distância</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {selectedDate ? (
                                slots.length > 0 ? (
                                    <ScrollArea className="h-[280px] pr-4">
                                        <div className="space-y-4">
                                            {slots.map(({ time, interviewers }) => (
                                                <div key={time} className="border rounded-lg p-3 bg-gray-50">
                                                    <div className="flex items-center mb-2">
                                                        <Badge variant="outline" className="bg-white text-sm px-2 py-1">
                                                            {time}
                                                        </Badge>
                                                        <span className="text-xs text-gray-500 ml-2">
                                                            {interviewers.length} entrevistador(es) livre(s)
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 pl-2">
                                                        {interviewers.map(interviewer => (
                                                            <div key={interviewer.id} className="flex items-center justify-between text-sm bg-white p-2 rounded border">
                                                                <div className="flex items-center gap-2">
                                                                    <User className="h-3 w-3 text-gray-400" />
                                                                    <span>{interviewer.name}</span>
                                                                </div>
                                                                <Button 
                                                                    size="sm" 
                                                                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                                    onClick={() => handleBooking(selectedDate, time, interviewer.id)}
                                                                    disabled={bookingLoading}
                                                                >
                                                                    Agendar
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <Clock className="h-8 w-8 mb-2 opacity-20" />
                                        <p>Sem horários livres</p>
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <CalendarIcon className="h-8 w-8 mb-2 opacity-20" />
                                    <p>Escolha um dia</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
