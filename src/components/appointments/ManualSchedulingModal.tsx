import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameDay, addMinutes, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Calendar as CalendarIcon, Clock, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const [loading, setLoading] = useState(false);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
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
  }, [selectedDate, availabilities]);

  const fetchAvailabilities = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('interviewer_availability')
        .select(`
          *,
          profiles!interviewer_availability_interviewer_id_fkey(name)
        `)
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) throw error;

      // Filter locally for Unit and Class logic (same as SelfScheduling)
      const filtered = (data || []).filter((avail: any) => {
        // Filter by Unit: Match specific unit OR Global (null)
        const unitMatch = !avail.unit_id || avail.unit_id === student.unit_id;
        
        // Filter by Class
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

        // Se a disponibilidade tem restrição de turma, o aluno DEVE estar na turma
        // Se a disponibilidade NÃO tem restrição de turma (todas), então serve
        const classMatch = !hasClassIds || includesClass;

        return unitMatch && classMatch;
      });

      setAvailabilities(filtered as unknown as Availability[]);
    } catch (error) {
      console.error('Error fetching availabilities:', error);
      toast.error('Erro ao carregar disponibilidades');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookedSlotsForDate = async () => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayAvails = availabilities.filter(a => a.date === dateStr);
    
    const interviewerIds = Array.from(new Set(dayAvails.map(a => a.interviewer_id)));

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

  const getSlotsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvails = availabilities.filter(a => a.date === dateStr);
    
    const slotsMap = new Map<string, { id: string, name: string }[]>();

    dayAvails.forEach(avail => {
      const slots = generateSlots(avail.start_time, avail.end_time);
      slots.forEach(time => {
        const existing = slotsMap.get(time) || [];
        // Check if booked
        const bookedInterviewers = bookedSlots[time] || [];
        if (!bookedInterviewers.includes(avail.interviewer_id)) {
            existing.push({
                id: avail.interviewer_id,
                name: avail.profiles?.name || 'Entrevistador'
            });
        }
        slotsMap.set(time, existing);
      });
    });

    return Array.from(slotsMap.entries())
      .map(([time, interviewers]) => ({ time, interviewers }))
      .filter(slot => slot.interviewers.length > 0)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const handleBooking = async (date: Date, time: string, interviewerId: string) => {
    setBookingLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');

      // Create appointment
      const { error } = await supabase
        .from('appointments')
        .insert({
          student_id: student.id,
          interviewer_id: interviewerId,
          appointment_date: dateStr,
          appointment_time: time,
          status: 'scheduled',
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
        // Não lançar erro aqui para não bloquear o fluxo, já que o agendamento foi criado
      }

      // Add interaction
      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          interaction_type: 'agendamento',
          comments: `Agendamento de entrevista para ${format(date, 'dd/MM/yyyy')} às ${time}`
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

  const availableDates = availabilities
    .map(a => parseISO(a.date))
    .filter((date, index, self) => 
      index === self.findIndex(d => isSameDay(d, date))
    );

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
                                available: { fontWeight: 'bold', textDecoration: 'underline', color: 'var(--primary)' }
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
