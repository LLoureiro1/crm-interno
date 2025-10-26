import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Phone, Mail, MapPin, GraduationCap, Percent, Clock, ArrowLeft, Home, Edit, Save, X, Trash2, DollarSign, CreditCard, BookOpen, Pen, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { MonthlyFeeCalculator } from '@/components/ui/MonthlyFeeCalculator';
import { MaterialDidaticoCalculator } from '@/components/ui/MaterialDidaticoCalculator';
import { MaterialPaymentSelector, type MaterialPaymentType } from '@/components/ui/MaterialPaymentSelector';
import { StudentPhoneManager } from '@/components/ui/StudentPhoneManager';
import { GradeEditor } from '@/components/GradeEditor';
import { ReactivateStudentButton } from '@/components/ui/ReactivateStudentButton';
import { ProposalSummaryModal } from '@/components/ui/ProposalSummaryModal';
import { toast } from 'sonner';
import { getCurrentDate } from '@/utils/dateUtils';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { sanitizeInteractionComment, sanitizeInput } from '@/utils/sanitization';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Student = Tables<'students'> & {
  classes: Tables<'classes'> & {
    units: Tables<'units'>;
    series: Tables<'series'>;
  };
};

type Profile = Tables<'profiles'>;

type ClassWithRelations = Tables<'classes'> & {
  units: Tables<'units'>;
  series: Tables<'series'>;
};

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [interviewers, setInterviewers] = useState<Profile[]>([]);
  const [comments, setComments] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [materialPaymentType, setMaterialPaymentType] = useState<'a_vista' | 'parcelado_cartao' | 'parcelado_boleto' | ''>('');
  const [materialInstallments, setMaterialInstallments] = useState<number>(2);
  const [tuitionInstallments, setTuitionInstallments] = useState<number>(12);
  const [newStatus, setNewStatus] = useState<Enums<'student_status'> | ''>('');
  const [dropoutReason, setDropoutReason] = useState<Enums<'dropout_reason'> | ''>('');
  const [dropoutComment, setDropoutComment] = useState<string>('');
  const [customDropoutReason, setCustomDropoutReason] = useState<string>('');
  const [invalidReason, setInvalidReason] = useState<string>('');
  const [interactions, setInteractions] = useState<Tables<'student_interactions'>[]>([]);
  const [hasHadInterview, setHasHadInterview] = useState<boolean>(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewerId, setInterviewerId] = useState('');
  const [formatoEntrevista, setFormatoEntrevista] = useState<'presencial' | 'a_distancia'>('presencial');
  const [currentAppointment, setCurrentAppointment] = useState<Tables<'appointments'> | null>(null);
  const [availableExamDates, setAvailableExamDates] = useState<Tables<'exam_dates'>[]>([]);
  const [selectedExamDateId, setSelectedExamDateId] = useState<string>('');
  const [showExamDateEditor, setShowExamDateEditor] = useState(false);

  // Estados para edição de série e unidade
  const [availableUnits, setAvailableUnits] = useState<Tables<'units'>[]>([]);
  const [availableSeries, setAvailableSeries] = useState<Tables<'series'>[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassWithRelations[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showSeriesUnitEditor, setShowSeriesUnitEditor] = useState(false);

  // Estados para edição de dados pessoais
  const [showPersonalDataEditor, setShowPersonalDataEditor] = useState(false);
  const [editingPersonalData, setEditingPersonalData] = useState({
    student_name: '',
    responsible_name: '',
    birth_date: '',
    phone: '',
    email: '',
    city: '',
    neighborhood: '',
    origin_school: ''
  });

  const canUpdateToMatriculado = profile?.profile === 'admin';
  const canRegisterAttendance = profile?.profile === 'entrevistador' || profile?.profile === 'direcao' || profile?.profile === 'admin';
  const canEditPersonalData = !!profile; // todos os perfis autenticados podem editar
  
  // Verificar se hoje é o dia da entrevista (usando data local)
  const today = getCurrentDate();
  const isInterviewDay = student?.interview_date === today;
  const [forceOpenAttendance, setForceOpenAttendance] = useState(false);


  useEffect(() => {
    if (id) {
      fetchStudent();
      fetchInterviewers();
    }
  }, [id]);

  useEffect(() => {
    if (student) {
      setNewStatus(student.status);
      fetchInteractions();
      fetchAvailableExamDates();
      fetchAvailableUnits(); // ADICIONAR
      fetchAvailableSeries(); // ADICIONAR
      fetchCurrentAppointment(); // Buscar appointment atual
      
      // Definir valores atuais como selecionados
      setSelectedUnitId(student.classes.unit_id);
      setSelectedSeriesId(student.classes.series_id);
      setSelectedClassId(student.class_id);
    }
  }, [student]);

  useEffect(() => {
    if (student?.classes?.parcelas) {
      setTuitionInstallments(student.classes.parcelas);
    } else {
      setTuitionInstallments(12);
    }
  }, [student?.classes?.parcelas]);

  // Buscar turmas quando unidade ou série mudarem
  useEffect(() => {
    if (selectedUnitId && selectedSeriesId) {
      fetchAvailableClasses(selectedUnitId, selectedSeriesId);
    }
  }, [selectedUnitId, selectedSeriesId]);

  const fetchStudent = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        classes!inner(
          *,
          units(*),
          series(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching student:', error);
      toast.error('Erro ao carregar dados do aluno');
      return;
    }

    setStudent(data);
  };

  const fetchInterviewers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('profile', ['entrevistador', 'direcao', 'admin'])
      .eq('ativo', true)
      .order('name');

    if (error) {
      console.error('Error fetching interviewers:', error);
      return;
    }

    setInterviewers(data || []);
  };

  const fetchInteractions = async () => {
    if (!id) return;

    const { data } = await supabase
      .from('student_interactions')
      .select(`
        *,
        profiles(name)
      `)
      .eq('student_id', id)
      .order('created_at', { ascending: false });

    if (data) {
      setInteractions(data);
      
      // Verificar se o aluno teve entrevista baseado nas interações
      const hasAttendimentoInteraction = data.some(
        interaction => interaction.interaction_type === 'atendimento'
      );
      setHasHadInterview(hasAttendimentoInteraction);
    }
  };

  const fetchCurrentAppointment = async () => {
    if (!id || !student?.interview_date) return;

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('student_id', id)
      .eq('appointment_date', student.interview_date)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setCurrentAppointment(data);
    }
  };

  const fetchAvailableExamDates = async () => {
    if (!student?.classes?.unit_id) return;

    const { data, error } = await supabase
      .from('exam_dates')
      .select('*')
      .eq('unit_id', student.classes.unit_id)
      .gte('exam_date', getCurrentDate())
      .order('exam_date', { ascending: true })
      .order('exam_time', { ascending: true });

    if (error) {
      console.error('Error fetching available exam dates:', error);
      return;
    }

    setAvailableExamDates(data || []);

    // Definir a data atual do aluno como selecionada se existir
    if ((student as any)?.exam_date_id) {
      setSelectedExamDateId((student as any).exam_date_id);
    }
  };

  // Função para buscar unidades disponíveis
  const fetchAvailableUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching units:', error);
      return;
    }

    setAvailableUnits(data || []);
  };

  // Função para buscar séries disponíveis
  const fetchAvailableSeries = async () => {
    const { data, error } = await supabase
      .from('series')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching series:', error);
      return;
    }

    setAvailableSeries(data || []);
  };

  // Função para buscar turmas baseadas na unidade e série selecionadas
  const fetchAvailableClasses = async (unitId: string, seriesId: string) => {
    if (!unitId || !seriesId) {
      setAvailableClasses([]);
      return;
    }

    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        units(*),
        series(*)
      `)
      .eq('unit_id', unitId)
      .eq('series_id', seriesId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching classes:', error);
      return;
    }

    setAvailableClasses(data || []);
  };

  // Função para alterar série/unidade do aluno
  const handleChangeSeriesUnit = async () => {
    if (!selectedClassId || !student?.id) {
      toast.error('Selecione uma turma válida');
      return;
    }

    try {
      const updateData: any = { class_id: selectedClassId };
      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id);

      if (error) throw error;

      // Adicionar interação
      const selectedClass = availableClasses.find(c => c.id === selectedClassId);
      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: profile?.id,
          interaction_type: 'mudanca_turma',
          comments: `Turma alterada para ${selectedClass?.name}` + 
            (selectedClass && 'series' in selectedClass && (selectedClass as any).series 
              ? ` - ${(selectedClass as any).series.name}` : '') + 
            (selectedClass && 'units' in selectedClass && (selectedClass as any).units 
              ? ` (${(selectedClass as any).units.name})` : '')
        });

      toast.success('Série e unidade alteradas com sucesso!');
      setShowSeriesUnitEditor(false);
      fetchStudent();
      fetchInteractions();
    } catch (error) {
      console.error('Error changing series/unit:', error);
      toast.error('Erro ao alterar série/unidade');
    }
  };

  const handleScheduleInterview = async () => {
    if (!interviewDate || !interviewTime || !interviewerId) {
      toast.error('Preencha todos os campos da entrevista');
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update({ 
          interview_date: interviewDate,
          status: 'atendimento_agendado'
        })
        .eq('id', id);

      if (error) throw error;

      // Add interaction
      await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'agendamento_entrevista',
          comments: `Entrevista agendada para ${formatDateForDisplay(interviewDate)} às ${interviewTime} com ${interviewers.find(i => i.id === interviewerId)?.name} (${formatoEntrevista === 'a_distancia' ? 'A distância' : 'Presencial'}). Status automaticamente alterado para "Atendimento Agendado".`,

        });

      // Add appointment record
      await supabase
        .from('appointments')
        .insert({
          student_id: id,
          interviewer_id: interviewerId,
          appointment_date: interviewDate,
          appointment_time: interviewTime,
          formato_entrevista: formatoEntrevista,
          status: 'scheduled' // Assuming a default status for new appointments
        });

      toast.success('Entrevista agendada com sucesso e status atualizado!');
      fetchStudent();
      fetchInteractions();
      setInterviewDate('');
      setInterviewTime('');
      setInterviewerId('');
      setFormatoEntrevista('presencial');
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast.error('Erro ao agendar entrevista');
    }
  };

  const handleCancelInterview = async () => {
    if (!student?.interview_date) {
      toast.error('Nenhuma entrevista agendada para cancelar');
      return;
    }

    // Confirmar cancelamento
    if (!confirm(`Tem certeza que deseja cancelar a entrevista agendada para ${formatDateForDisplay(student.interview_date)}?`)) {
      return;
    }

    try {
      // Buscar o agendamento para deletar
      const { data: appointments, error: fetchError } = await supabase
        .from('appointments')
        .select('id')
        .eq('student_id', id)
        .eq('appointment_date', student.interview_date);

      if (fetchError) {
        console.error('Error fetching appointments:', fetchError);
      }

      // Deletar o agendamento se existir
      if (appointments && appointments.length > 0) {
        const { error: deleteError } = await supabase
          .from('appointments')
          .delete()
          .eq('student_id', id)
          .eq('appointment_date', student.interview_date);

        if (deleteError) {
          console.error('Error deleting appointment:', deleteError);
        }
      }

      // Atualizar o status do aluno para 'nenhum_agendamento' e limpar a data da entrevista
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({ 
          status: 'nenhum_agendamento',
          interview_date: null
        })
        .eq('id', id);

      if (studentUpdateError) throw studentUpdateError;

      // Registrar interação documentando o cancelamento
      const { error: interactionError } = await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'mudanca_status',
          comments: `Entrevista cancelada. Status alterado para "Nenhum Agendamento". Entrevista estava agendada para ${formatDateForDisplay(student.interview_date)}.`
        });

      if (interactionError) {
        console.error('Error inserting interaction:', interactionError);
        // Não falha a operação se não conseguir registrar a interação
      }

      toast.success('Entrevista cancelada com sucesso');
      fetchStudent();
      fetchInteractions();
    } catch (error) {
      console.error('Error canceling interview:', error);
      toast.error('Erro ao cancelar entrevista');
    }
  };

  const handleAddInteraction = async () => {
    if (!comments.trim()) {
      toast.error('Adicione um comentário');
      return;
    }

    // Sanitizar o comentário antes de salvar
    const sanitizedComment = sanitizeInput(comments.trim());

    try {
      const { error } = await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'comentario',
          comments: sanitizedComment
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

  const handleRegisterAttendance = async () => {
    if (!discountPercentage) {
      toast.error('Preencha o percentual de desconto');
      return;
    }

    if (!materialPaymentType) {
      toast.error('Selecione a forma de pagamento dos recursos didáticos');
      return;
    }

    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast.error('Percentual de desconto deve estar entre 0% e 100%');
      return;
    }

    // Calcular desconto do material baseado no tipo de pagamento
    const materialDiscount = materialPaymentType === 'a_vista' ? 10 : 
                            materialPaymentType === 'parcelado_cartao' ? 5 : 0;

    // Calcular valor da parcela do material
    const materialAnual = student?.classes.material_didatico_anual || 0;
    const materialComDesconto = materialAnual * (1 - (materialDiscount / 100));
    const materialParcela = materialComDesconto / materialInstallments;

    try {
      // 1. Buscar e atualizar appointment se existir
      const { data: appointments, error: fetchAppointmentError } = await supabase
        .from('appointments')
        .select('id')
        .eq('student_id', id)
        .eq('appointment_date', student?.interview_date);

      if (fetchAppointmentError) {
        console.error('Error fetching appointment:', fetchAppointmentError);
      }

      // Atualizar appointment se existir
      if (appointments && appointments.length > 0) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({
            status: 'realizado',
            attended: true,
            discount_percentage: discount,
            comments: comments.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', appointments[0].id);

        if (appointmentError) {
          console.error('Error updating appointment:', appointmentError);
          // Continuar mesmo se falhar a atualização do appointment para não bloquear o fluxo
        }
      }

      // 2. Update student with discount, material payment info and status
      const { error: studentError } = await supabase
        .from('students')
        .update({
          discount_percentage: discount,
          discount_material: materialDiscount,
          material_payment_type: materialPaymentType,
          material_installments: materialInstallments,
          material_parcela: materialParcela,
          status: 'atendimento_recentemente'
        })
        .eq('id', id);

      if (studentError) throw studentError;

      // 3. Add interaction
      const paymentTypeText = materialPaymentType === 'a_vista' ? 'À Vista' : 
                              materialPaymentType === 'parcelado_cartao' ? `Cartão ${materialInstallments}x` : 
                              `Boleto ${materialInstallments}x`;

      const annuityOriginal = student?.classes?.annuity ?? (
        (student?.classes?.monthly_fee || 0) * (student?.classes?.parcelas || 12)
      );
      const finalMonthlyFee = (
        annuityOriginal * (1 - (discount / 100))
      ) / Math.max(1, tuitionInstallments);
      
      const { error: interactionError } = await supabase
        .from('student_interactions')
        .insert({
          student_id: id,
          user_id: profile?.id,
          interaction_type: 'atendimento',
          comments: `Atendimento realizado. Mensalidade negociada: ${discount}% de desconto em ${tuitionInstallments}x. Material: ${paymentTypeText} (${materialDiscount}% desconto). ${comments.trim()}`
        });

      if (interactionError) throw interactionError;

      toast.success('Atendimento registrado com sucesso');
      fetchStudent();
      fetchInteractions();
      setDiscountPercentage('');
      setMaterialPaymentType('');
      setMaterialInstallments(2);
      setComments('');
    } catch (error) {
      console.error('Error registering attendance:', error);
      toast.error('Erro ao registrar atendimento');
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    
    if (newStatus === 'desistente' && !dropoutReason) {
      toast.error('Selecione o motivo da desistência');
      return;
    }

    if (newStatus === 'desistente' && dropoutReason === 'outro' && !customDropoutReason.trim()) {
      toast.error('Especifique o motivo da desistência');
      return;
    }

    if (newStatus === 'cadastro_invalido' && !invalidReason) {
      toast.error('Selecione o motivo do cadastro inválido');
      return;
    }

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'desistente') {
        updateData.dropout_reason = dropoutReason;
        const commentParts: string[] = [];
        if (dropoutReason === 'outro' && customDropoutReason.trim()) {
          commentParts.push(customDropoutReason.trim());
        }
        if (dropoutComment.trim()) {
          commentParts.push(dropoutComment.trim());
        }
        if (commentParts.length) {
          updateData.dropout_comment = commentParts.join(' - ');
        }
      }
      if (newStatus === 'cadastro_invalido') {
        updateData.invalid_reason = invalidReason;
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
          comments: `Status alterado para: ${newStatus === 'cadastro_invalido' ? 'Cadastro Inválido' : newStatus}${newStatus === 'desistente' ? ` (Motivo: ${dropoutReason}${dropoutReason === 'outro' && customDropoutReason.trim() ? ` - ${customDropoutReason.trim()}` : ''}${dropoutComment.trim() ? ` - ${dropoutComment.trim()}` : ''})` : newStatus === 'cadastro_invalido' ? ` (Motivo: ${invalidReason === 'cadastro_duplicado' ? 'Cadastro Duplicado' : invalidReason === 'cadastro_de_teste' ? 'Cadastro de Teste' : invalidReason})` : ''}`
        });

      toast.success('Status atualizado com sucesso');
      fetchStudent();
      fetchInteractions();
      // Limpar campos após sucesso
      setDropoutReason('');
      setCustomDropoutReason('');
      setDropoutComment('');
      setInvalidReason('');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleChangeExamDate = async () => {
    if (!selectedExamDateId || !student?.id) {
      toast.error('Selecione uma data de prova válida');
      return;
    }

    try {
      const selectedExamDate = availableExamDates.find(ed => ed.id === selectedExamDateId);
      const newExamDate = selectedExamDate?.exam_date;
      const currentExamDate = student.exam_date;
      
      // Verificar se a nova data é posterior à data atual
      const isNewDateLater = newExamDate && currentExamDate && new Date(newExamDate) > new Date(currentExamDate);
      
      // Preparar dados para atualização
      const updateData: any = { exam_date_id: selectedExamDateId };
      
      // Se o aluno está ausente e a nova data é posterior, alterar status para não confirmado
      if (student.status === 'ausente' && isNewDateLater) {
        updateData.status = 'nao_confirmado';
      }

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id);

      if (error) throw error;

      // Adicionar interação
      let interactionComment = `Data da prova alterada para ${formatDateForDisplay(selectedExamDate?.exam_date || '')} às ${selectedExamDate?.exam_time.substring(0, 5) || ''}`;
      
      // Adicionar informação sobre mudança de status se aplicável
      if (student.status === 'ausente' && isNewDateLater) {
        interactionComment += '. Status automaticamente alterado de "Ausente" para "Não Confirmado" devido à nova data ser posterior.';
      }

      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: profile?.id,
          interaction_type: 'mudanca_data_prova',
          comments: interactionComment
        });

      const successMessage = student.status === 'ausente' && isNewDateLater 
        ? 'Data da prova alterada com sucesso! Status automaticamente alterado para "Não Confirmado".'
        : 'Data da prova alterada com sucesso!';
        
      toast.success(successMessage);
      setShowExamDateEditor(false);
      fetchStudent();
      fetchInteractions();
    } catch (error) {
      console.error('Error changing exam date:', error);
      toast.error('Erro ao alterar data da prova');
    }
  };

  // Função para atualizar dados pessoais
  const handleUpdatePersonalData = async () => {
    if (!student) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({
          student_name: editingPersonalData.student_name,
          responsible_name: editingPersonalData.responsible_name,
          birth_date: editingPersonalData.birth_date,
          phone: editingPersonalData.phone,
          email: editingPersonalData.email,
          city: editingPersonalData.city,
          neighborhood: editingPersonalData.neighborhood,
          origin_school: editingPersonalData.origin_school
        })
        .eq('id', student.id);

      if (error) throw error;

      // Adicionar interação
      await supabase
        .from('student_interactions')
        .insert({
          student_id: student.id,
          user_id: profile?.id,
          interaction_type: 'dados_pessoais_alterados',
          comments: 'Dados pessoais foram atualizados'
        });

      toast.success('Dados pessoais atualizados com sucesso');
      setShowPersonalDataEditor(false);
      fetchStudent(); // Recarregar dados do estudante
      fetchInteractions();
    } catch (error) {
      console.error('Error updating personal data:', error);
      toast.error('Erro ao atualizar dados pessoais');
    }
  };

  // Função para iniciar edição
  const startEditingPersonalData = () => {
    if (student) {
      setEditingPersonalData({
        student_name: student.student_name,
        responsible_name: student.responsible_name,
        birth_date: student.birth_date,
        phone: student.phone,
        email: student.email,
        city: student.city || '',
        neighborhood: student.neighborhood,
        origin_school: student.origin_school
      });
      setShowPersonalDataEditor(true);
    }
  };

  // Função para cancelar edição
  const cancelEditingPersonalData = () => {
    setShowPersonalDataEditor(false);
    setEditingPersonalData({
      student_name: '',
      responsible_name: '',
      birth_date: '',
      phone: '',
      email: '',
      city: '',
      neighborhood: '',
      origin_school: ''
    });
  };

  const getStatusBadge = (status: string) => {
      const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "purple" | "warning" | "ausente" | "cadastro_invalido" | "processo_anos_anteriores" } } = {
        'nao_confirmado': { label: 'Não Confirmado', variant: 'outline' },
        'confirmado': { label: 'Confirmado', variant: 'secondary' },
        'cadastro_invalido': { label: 'Cadastro Inválido', variant: 'cadastro_invalido' },
        'matriculado': { label: 'Matriculado', variant: 'success' },
        'desistente': { label: 'Desistente', variant: 'destructive' },
        'nenhum_agendamento': { label: 'Nenhum Agendamento', variant: 'outline' },
        'atendimento_agendado': { label: 'Atendimento Agendado', variant: 'secondary' },
        'faltou_ao_atendimento': { label: 'Faltou ao Atendimento', variant: 'purple' },
        'atendimento_recentemente': { label: 'Atendimento Recentemente', variant: 'default' },
        'atendimento_ha_mais_de_uma_semana': { label: 'Atendimento há mais de uma semana', variant: 'warning' },
        'ausente': { label: 'Ausente', variant: 'ausente' },
        'processo_anos_anteriores': { label: 'Processo Anos Anteriores', variant: 'processo_anos_anteriores' }
      };

      const config = statusMap[status] || { label: status, variant: 'outline' as const };
      return <Badge variant={config.variant}>{config.label}</Badge>;
    };

  if (!student) {
    return (
      <div className="min-h-screen bg-blue-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="flex items-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>Tela Inicial</span>
            </Button>
            <Button 
              onClick={() => navigate('/', { state: { activeTab: 'students' } })} 
              variant="outline" 
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para Lista de Inscritos</span>
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <User className="h-6 w-6" />
            <span>Ficha do Aluno - {student.student_name}</span>
          </h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-gray-600">Código: {student.code}</span>
            <span>|</span>
            <span>Status: {getStatusBadge(student.status)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student Information */}
          <div className="space-y-4">
            {/* Student Reactivation */}
            <ReactivateStudentButton 
              student={student} 
              onSuccess={fetchStudent}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Dados Pessoais</span>
                  </div>
                  {canEditPersonalData && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={showPersonalDataEditor ? cancelEditingPersonalData : startEditingPersonalData}
                      className="flex items-center space-x-1"
                    >
                      {showPersonalDataEditor ? (
                        <>
                          <X className="h-3 w-3" />
                          <span>Cancelar</span>
                        </>
                      ) : (
                        <>
                          <Edit className="h-3 w-3" />
                          <span>Editar</span>
                        </>
                      )}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {showPersonalDataEditor ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="student_name">Nome do Aluno</Label>
                        <Input
                          id="student_name"
                          value={editingPersonalData.student_name}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            student_name: e.target.value
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="responsible_name">Responsável</Label>
                        <Input
                          id="responsible_name"
                          value={editingPersonalData.responsible_name}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            responsible_name: e.target.value
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="birth_date">Data de Nascimento</Label>
                        <Input
                          id="birth_date"
                          type="date"
                          value={editingPersonalData.birth_date}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            birth_date: e.target.value
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          value={editingPersonalData.phone}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            phone: e.target.value
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={editingPersonalData.email}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            email: e.target.value
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          value={editingPersonalData.city}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            city: e.target.value
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input
                          id="neighborhood"
                          value={editingPersonalData.neighborhood}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            neighborhood: e.target.value
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="origin_school">Escola de Origem</Label>
                        <Input
                          id="origin_school"
                          value={editingPersonalData.origin_school}
                          onChange={(e) => setEditingPersonalData(prev => ({
                            ...prev,
                            origin_school: e.target.value
                          }))}
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleUpdatePersonalData}
                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                      >
                        <Save className="h-3 w-3" />
                        <span>Salvar</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={cancelEditingPersonalData}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
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
                      <p>{formatDateForDisplay(student.birth_date)}</p>
                    </div>
                    <div className="col-span-2">
                      <StudentPhoneManager 
                        studentId={student.id}
                        disabled={!canEditPersonalData}
                      />
                    </div>
                    <div className="flex items-center space-x-1">
                      <Mail className="h-3 w-3" />
                      <span className="font-medium">Email:</span>
                      <p>{student.email}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span className="font-medium">Cidade:</span>
                      <p>{student.city || 'Não informado'}</p>
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
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GraduationCap className="h-4 w-4" />
                  <span>Dados Acadêmicos</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium">Série:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <p>{student.classes.series.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          fetchAvailableUnits();
                          fetchAvailableSeries();
                          setShowSeriesUnitEditor(!showSeriesUnitEditor);
                        }}
                      >
                        {showSeriesUnitEditor ? 'Cancelar' : 'Alterar'}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Unidade:</span>
                    <p>{student.classes.units.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Turma:</span>
                    <p>{student.classes.name}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">Data da Inscrição:</span>
                    <p>{formatDateForDisplay(student.created_at.split('T')[0])}</p>
                  </div>
                  
                  {/* Editor de série e unidade */}
                  {showSeriesUnitEditor && (
                    <div className="col-span-2 mt-3 p-3 bg-gray-50 rounded-lg">
                      <Label>Alterar Série e Unidade</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <Label htmlFor="unit-select" className="text-xs">Unidade</Label>
                          <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent side="bottom">
                              {availableUnits.map(unit => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="series-select" className="text-xs">Série</Label>
                          <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent side="bottom">
                              {availableSeries.map(series => (
                                <SelectItem key={series.id} value={series.id}>
                                  {series.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="class-select" className="text-xs">Turma</Label>
                          <Select 
                            value={selectedClassId} 
                            onValueChange={setSelectedClassId}
                            disabled={!selectedUnitId || !selectedSeriesId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione turma" />
                            </SelectTrigger>
                            <SelectContent side="bottom">
                              {availableClasses.map(cls => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <Button
                        onClick={handleChangeSeriesUnit}
                        disabled={!selectedClassId || selectedClassId === student.class_id}
                        size="sm"
                        className="mt-3 bg-blue-500 hover:bg-blue-600"
                      >
                        Confirmar Alteração
                      </Button>
                    </div>
                  )}
                  {student.classes?.has_exam && (
                    <div className="col-span-2">
                      <GradeEditor student={student} onUpdate={fetchStudent} variant="inline" />
                    </div>
                  )}
                  {student.classes?.has_exam && (
                    <div className="col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Data da Prova:</span>
                          {student.exam_date ? (
                            <p className="mt-1">{formatDateForDisplay(student.exam_date)}</p>
                          ) : (
                            <p className="mt-1 text-gray-500">Não informado</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            fetchAvailableExamDates();
                            setShowExamDateEditor(!showExamDateEditor);
                          }}
                        >
                          {showExamDateEditor ? 'Cancelar' : 'Alterar'}
                        </Button>
                      </div>
                      
                      {/* Editor de data da prova */}
                      {showExamDateEditor && availableExamDates.length > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <Label htmlFor="exam-date-select">Nova Data da Prova</Label>
                          <div className="flex items-center space-x-2 mt-2">
                            <Select 
                              value={selectedExamDateId} 
                              onValueChange={setSelectedExamDateId}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Selecione uma nova data" />
                              </SelectTrigger>
                              <SelectContent side="bottom">
                                {availableExamDates.map(examDate => (
                                  <SelectItem key={examDate.id} value={examDate.id}>
                                    {formatDateForDisplay(examDate.exam_date)} às {examDate.exam_time.substring(0, 5)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={handleChangeExamDate}
                              disabled={!selectedExamDateId || selectedExamDateId === (student as any)?.exam_date_id}
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600"
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {student.interview_date && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">Data da Entrevista:</span>
                          <p className={isInterviewDay ? 'text-green-600 font-bold' : ''}>
                            {formatDateForDisplay(student.interview_date)}
                            {isInterviewDay && ' (HOJE)'}
                          </p>
                        </div>
                        {/* Ações: cancelar entrevista */}
                        {canRegisterAttendance && (
                          <div className="flex items-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelInterview}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Cancelar entrevista"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {currentAppointment && (
                        <div className="flex items-center space-x-2 ml-4">
                          <span className="text-sm text-gray-600">Formato:</span>
                          <Badge variant={currentAppointment.formato_entrevista === 'a_distancia' ? 'secondary' : 'outline'}>
                            {currentAppointment.formato_entrevista === 'a_distancia' ? 'A Distância' : 'Presencial'}
                          </Badge>
                        </div>
                      )}

                      {canRegisterAttendance && !!student?.interview_date && !((isInterviewDay || (forceOpenAttendance && !!student?.interview_date)) && student.status !== 'atendimento_recentemente') && (
                        <div className="mt-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setForceOpenAttendance(true)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Abrir Registrar Atendimento"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Registrar Atendimento
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financial Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Pen className="h-4 w-4" />
                    <span>Proposta</span>
                  </div>
                  {hasHadInterview && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowProposalModal(true)}
                      className="flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Ver Resumo</span>
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Monthly Fee Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Mensalidade</span>
                  </div>
                  <MonthlyFeeCalculator
                    originalFee={student.classes.monthly_fee}
                    discountPercentage={student.discount_percentage}
                    showAnnualSavings={true}
                    showClassName={true}
                    className={student.classes.name}
                    hasHadInterview={hasHadInterview}
                    annuity={student.classes.annuity ?? ((student.classes.monthly_fee || 0) * (student.classes.parcelas || 12))}
                    parcelas={student.classes.parcelas || 12}
                  />
                </div>

                {/* Recursos Didáticos Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-purple-900">Recursos Didáticos</span>
                  </div>
                  <MaterialDidaticoCalculator
                    materialAnual={student.classes.material_didatico_anual || 0}
                    materialMensal={student.classes.material_didatico_mes || 0}
                    discountMaterial={student.discount_material || 0}
                    hasHadInterview={hasHadInterview}
                    paymentType={(student as any).material_payment_type || null}
                    installments={(student as any).material_installments || null}
                    savedInstallmentValue={(student as any).material_parcela || null}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Interview Scheduling */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Agendar Entrevista</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="interview-date">Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {interviewDate ? (
                            format(new Date(interviewDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                          ) : (
                            <span>Escolha a data</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={interviewDate ? new Date(interviewDate + 'T00:00:00') : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              setInterviewDate(`${year}-${month}-${day}`);
                            }
                          }}
                          fromDate={startOfToday()}
                          disabled={{ before: startOfToday() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="interview-time">Horário</Label>
                    <Select value={interviewTime} onValueChange={setInterviewTime}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, hour) => {
                          return [0, 30]
                            .map((minute) => {
                              const withinBusinessHours = hour >= 7 && hour <= 21;
                              const isDisallowedLateSlot = hour === 21 && minute === 30; // Excluir 21:30
                              if (!withinBusinessHours || isDisallowedLateSlot) return null;

                              const timeValue = `${hour.toString().padStart(2, '0')}:${minute
                                .toString()
                                .padStart(2, '0')}`;
                              const displayTime = `${hour.toString().padStart(2, '0')}:${minute
                                .toString()
                                .padStart(2, '0')}`;
                              return (
                                <SelectItem key={timeValue} value={timeValue}>
                                  {displayTime}
                                </SelectItem>
                              );
                            })
                            .filter(Boolean);
                        }).flat()}
                      </SelectContent>
                    </Select>                   
                  </div>
                  <div>
                    <Label htmlFor="interviewer">Entrevistador</Label>
                    <Select value={interviewerId} onValueChange={setInterviewerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent side="bottom">
                        {interviewers.map(interviewer => (
                          <SelectItem key={interviewer.id} value={interviewer.id}>
                            {interviewer.name}
                          </SelectItem>
                        ))}
                              </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Checkbox para formato da entrevista */}
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="formato-entrevista"
                    checked={formatoEntrevista === 'a_distancia'}
                    onCheckedChange={(checked) => 
                      setFormatoEntrevista(checked ? 'a_distancia' : 'presencial')
                    }
                  />
                  <Label 
                    htmlFor="formato-entrevista" 
                    className="cursor-pointer text-sm font-normal"
                  >
                    Entrevista a distância
                  </Label>
                </div>
                
                <Button 
                  onClick={handleScheduleInterview}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Agendar Entrevista
                </Button>
              </CardContent>
            </Card>

            {/* Actions - Only show Register Attendance if it's interview day */}
            {canRegisterAttendance && (isInterviewDay || (forceOpenAttendance && !!student?.interview_date)) && student.status !== 'atendimento_recentemente' && (
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
                      step="0.1"
                      value={discountPercentage}
                      onChange={(e) => {
                        const value = e.target.value;
                        const numValue = parseFloat(value);
                        if (value === '' || (numValue >= 0 && numValue <= 100)) {
                          setDiscountPercentage(value);
                        }
                      }}
                      placeholder="Ex: 10.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tuition-installments">Parcelas da Anuidade</Label>
                    <Input
                      id="tuition-installments"
                      type="number"
                      min="1"
                      max="12"
                      value={tuitionInstallments}
                      onChange={(e) => setTuitionInstallments(Math.max(1, parseInt(e.target.value || '1')))}
                      placeholder="Ex: 12"
                    />
                  </div>

                  {/* Cálculo em tempo real da mensalidade */}
                  {student?.classes?.monthly_fee && (
                    <div className="bg-green-50 p-4 rounded-lg border">
                      <div className="flex items-center space-x-2 mb-3">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">Mensalidade com Desconto</span>
                      </div>
                      {(() => {
                        const discount = discountPercentage ? parseFloat(discountPercentage) : 0;
                        const originalFee = student.classes.monthly_fee;
                        const annuityOriginal = student.classes.annuity ?? (
                          originalFee * (student.classes.parcelas || 12)
                        );
                        const annuityDiscounted = annuityOriginal * (1 - (discount / 100));
                        const monthlyNegotiated = annuityDiscounted / Math.max(1, tuitionInstallments);
                        const savings = originalFee - monthlyNegotiated;
                        const annualSavings = annuityOriginal - annuityDiscounted;
                        
                        return (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Mensalidade Original:</span>
                              <p className="font-semibold text-lg">R$ {originalFee.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Parcelas:</span>
                              <p className="font-semibold text-lg text-green-700">{tuitionInstallments}x de R$ {monthlyNegotiated.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Anuidade com desconto:</span>
                              <p className="font-semibold text-lg text-green-700">R$ {annuityDiscounted.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Economia Anual:</span>
                              <p className="font-semibold text-lg text-green-600">R$ {annualSavings.toFixed(2)}</p>
                            </div>                            
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Seleção de Pagamento dos Recursos Didáticos */}
                  <div className="pt-4 border-t">
                    <MaterialPaymentSelector
                      paymentType={materialPaymentType as MaterialPaymentType}
                      installments={materialInstallments}
                      onPaymentTypeChange={(type) => setMaterialPaymentType(type)}
                      onInstallmentsChange={setMaterialInstallments}
                    />
                  </div>

                  {/* Preview do cálculo de recursos didáticos em tempo real */}
                  {materialPaymentType && student?.classes && (
                    <div className="pt-2">
                      <MaterialDidaticoCalculator
                        materialAnual={student.classes.material_didatico_anual || 0}
                        materialMensal={student.classes.material_didatico_mes || 0}
                        discountMaterial={materialPaymentType === 'a_vista' ? 10 : 
                                         materialPaymentType === 'parcelado_cartao' ? 5 : 0}
                        hasHadInterview={true}
                        paymentType={materialPaymentType}
                        installments={materialInstallments}
                      />
                    </div>
                  )}

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
                    <SelectContent side="bottom">
                      <SelectItem value="nao_confirmado">Não Confirmado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="cadastro_invalido">Cadastro Inválido</SelectItem>
                      <SelectItem value="nenhum_agendamento">Nenhum Agendamento</SelectItem>
                      <SelectItem value="desistente">Desistente</SelectItem>
                      {canUpdateToMatriculado && (
                        <SelectItem value="matriculado">Matriculado</SelectItem>
                      )}
                              </SelectContent>
                  </Select>
                </div>

                {newStatus === 'desistente' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="dropout-reason">Motivo da Desistência</Label>
                      <Select value={dropoutReason} onValueChange={(value) => {
                        setDropoutReason(value as Enums<'dropout_reason'>);
                        if (value !== 'outro') {
                          setCustomDropoutReason(''); // Limpa o motivo customizado se não for "outro"
                        }
                        // Não limpar mais o comentário ao trocar o motivo; é opcional para todos os motivos
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o motivo" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          <SelectItem value="impossibilidade_contato">Impossibilidade de contato</SelectItem>
                          <SelectItem value="mudanca_de_endereco">Mudança de Endereço</SelectItem>
                          <SelectItem value="matriculou_outra_escola">Matriculou em Outra Escola</SelectItem>
                          <SelectItem value="ja_e_aluno">Já é aluno</SelectItem>
                          <SelectItem value="motivos_financeiros">Motivos Financeiros</SelectItem>
                          <SelectItem value="falta_vaga">Falta de Vaga</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                              </SelectContent>
                      </Select>
                    </div>
                    
                    {dropoutReason === 'outro' && (
                      <div>
                        <Label htmlFor="custom-dropout-reason">Especifique o motivo</Label>
                        <Input
                          id="custom-dropout-reason"
                          value={customDropoutReason}
                          onChange={(e) => setCustomDropoutReason(e.target.value)}
                          placeholder="Digite o motivo da desistência..."
                          maxLength={200}
                        />
                      </div>
                    )}
                    
                    {/* Campo de texto opcional para qualquer motivo */}
                    {dropoutReason && (
                      <div>
                        <Label htmlFor="dropout-comment">Detalhes do motivo (opcional)</Label>
                        <Textarea
                          id="dropout-comment"
                          value={dropoutComment}
                          onChange={(e) => setDropoutComment(e.target.value)}
                          placeholder="Adicione mais contexto, se desejar."
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                )}

                {newStatus === 'cadastro_invalido' && (
                  <div>
                    <Label htmlFor="invalid-reason">Motivo do Cadastro Inválido</Label>
                    <Select value={invalidReason} onValueChange={setInvalidReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent side="bottom">
                        <SelectItem value="cadastro_duplicado">Cadastro Duplicado</SelectItem>
                        <SelectItem value="cadastro_de_teste">Cadastro de Teste</SelectItem>
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
          </div>

          {/* Interactions */}
          <div className="space-y-4">
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
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
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
                        <p 
                          className="text-sm text-gray-700"
                          dangerouslySetInnerHTML={{ 
                            __html: sanitizeInteractionComment(interaction.comments || '') 
                          }}
                        />
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

        {/* Modal de Resumo da Proposta */}
        {hasHadInterview && (
          <ProposalSummaryModal
            open={showProposalModal}
            onOpenChange={setShowProposalModal}
            student={student}
          />
        )}
      </div>
    </div>
  );
};

export default StudentProfile;
