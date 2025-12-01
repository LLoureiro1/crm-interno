
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { toPng } from 'html-to-image';

const PieSection: React.FC<{ title: string; data: Array<{ [key: string]: any }>; labelKey: string; valueKey: string }> = ({ title, data, labelKey, valueKey }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const COLORS = ['#2563eb', '#16a34a', '#9333ea', '#f59e0b', '#ef4444', '#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#e11d48'];
  const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);

  const handleDownload = async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar gráfico:', err);
    }
  };

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
        <Button variant="outline" size="sm" onClick={handleDownload}>Baixar imagem</Button>
      </div>
      <div ref={chartRef} className="w-full">
        <div className="hidden md:block w-full h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey={valueKey} nameKey={labelKey} outerRadius={100} labelLine={false}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [value, name]} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value: any, entry: any) => {
                  const v = Number(entry?.payload?.[valueKey] ?? entry?.payload?.value ?? 0);
                  const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                  return `${value} (${pct}%)`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="block md:hidden w-full h-56">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey={valueKey} nameKey={labelKey} outerRadius={80} labelLine={false}>
                {data.map((entry, index) => (
                  <Cell key={`cell-m-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="md:hidden mt-2 space-y-1">
          {data.map((entry, index) => {
            const v = Number(entry?.[valueKey] ?? 0);
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <div key={`legend-m-${index}`} className="flex items-center justify-between text-xs">
                <span className="flex items-center">
                  <span style={{ backgroundColor: COLORS[index % COLORS.length] }} className="inline-block w-2.5 h-2.5 rounded-sm mr-2"></span>
                  {String(entry[labelKey])} ({pct}%)
                </span>
                <span className="text-gray-600">{v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const AdvancedReportsTab = () => {
    const [conversionRate, setConversionRate] = useState(0);
    const [averageDiscount, setAverageDiscount] = useState(0);
    const [averageMonthlyFee, setAverageMonthlyFee] = useState(0);
    const [interviewerStats, setInterviewerStats] = useState<Array<{name: string, conversion: number, total: number, enrolled: number}>>([]);

    // Função para calcular o ano letivo atual
    const getCurrentAcademicYear = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12

        // Se é agosto ou depois, o ano letivo é o próximo ano
        if (currentMonth >= 8) {
            return String(currentYear + 1);
        }
        // Caso contrário, é o ano atual
        return String(currentYear);
    };
    
    // Estados dos filtros
    const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const [units, setUnits] = useState<Tables<'units'>[]>([]);
    const [classes, setClasses] = useState<Tables<'classes'>[]>([]);
    const [filteredClasses, setFilteredClasses] = useState<Tables<'classes'>[]>([]);
    const [registrationSourcesPie, setRegistrationSourcesPie] = useState<{ data: Array<{ name: string; value: number }> }>({ data: [] });
    const [trackingSourcesPie, setTrackingSourcesPie] = useState<{ data: Array<{ name: string; value: number }> }>({ data: [] });

    // Estados para estatísticas de entrevistas
    const [scheduledInterviews, setScheduledInterviews] = useState(0);
    const [completedInterviews, setCompletedInterviews] = useState(0);
    const [interviewCompletionRate, setInterviewCompletionRate] = useState(0);

    // Estados para relatório de origens de inscrição
    const [registrationSources, setRegistrationSources] = useState<Array<{
        source_label: string;
        total_students: number;
        percentage: number;
        enrolled_students: number;
        conversion_rate: number;
    }>>([]);

    // Estados para relatório de tracking codes
    const [trackingSources, setTrackingSources] = useState<Array<{
        tracking_code: string;
        total_students: number;
        percentage: number;
        enrolled_students: number;
        conversion_rate: number;
    }>>([]);

    // Estados para relatório de tentativas de contato
    const [contactsByChannel, setContactsByChannel] = useState<Array<{ channel: string; total: number; succeeded: number }>>([]);
    const [contactsByReason, setContactsByReason] = useState<Array<{ reason: string; total: number; succeeded: number }>>([]);
    const [avgContactsPerEnrolled, setAvgContactsPerEnrolled] = useState(0);

    // Estados para presença em provas (datas passadas)
    const [examAttendanceStats, setExamAttendanceStats] = useState<Array<{
        exam_date: string;
        unit_name: string;
        registered: number;
        attended: number;
        attendance_rate: number;
    }>>([]);

    // Estados para novas métricas solicitadas
    const [averageEnrollmentTimeDays, setAverageEnrollmentTimeDays] = useState(0);
    const [dropoutReasonStats, setDropoutReasonStats] = useState<Array<{ reason: string; count: number; percentage: number }>>([]);
    const [contactsByAttendant, setContactsByAttendant] = useState<Array<{ attendant_name: string; total: number }>>([]);

    // Funções para buscar dados de filtros
    const fetchUnits = async () => {
        const { data, error } = await supabase
            .from('units')
            .select('*')
            .order('name');
        
        if (error) {
            console.error('Erro ao buscar unidades:', error);
            return;
        }
        
        setUnits(data || []);
    };

    const fetchClasses = async () => {
        const { data, error } = await supabase
            .from('classes')
            .select(`
                *,
                units(name),
                series(name)
            `)
            .order('name');
        
        if (error) {
            console.error('Erro ao buscar turmas:', error);
            return;
        }
        
        setClasses(data || []);
        setFilteredClasses(data || []);
    };

    // Função: presença em provas por data (apenas datas passadas)
    const fetchExamAttendanceStats = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Buscar datas de prova passadas (filtrando por unidade se aplicável)
            let examDatesQuery = (supabase as any)
                .from('exam_dates')
                .select(`id, exam_date, units(name), unit_id`)
                .lt('exam_date', today)
                .order('exam_date', { ascending: true });

            if (selectedUnitId !== 'all') {
                examDatesQuery = examDatesQuery.eq('unit_id', selectedUnitId);
            }

            const { data: examDates, error: examDatesError } = await examDatesQuery;
            if (examDatesError) {
                console.error('Erro ao buscar datas de prova:', examDatesError);
                setExamAttendanceStats([]);
                return;
            }

            const pastExamDates = (examDates || []) as Array<{ id: string; exam_date: string; units: { name: string } }>;            
            if (pastExamDates.length === 0) {
                setExamAttendanceStats([]);
                return;
            }

            // Buscar alunos filtrados por ano letivo/unidade/turma e com exam_date definido
            let studentsQuery = supabase
                .from('students')
                .select('id, exam_date, math_grade, portuguese_grade, status');

            studentsQuery = applyFilters(studentsQuery)
                .not('exam_date', 'is', null)
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');

            const { data: studentsData, error: studentsError } = await studentsQuery;
            if (studentsError) {
                console.error('Erro ao buscar alunos para presença em provas:', studentsError);
                setExamAttendanceStats([]);
                return;
            }

            const students = (studentsData || []) as Array<{ id: string; exam_date: string | null; math_grade: number | null; portuguese_grade: number | null }>;

            // Agregar por data de prova
            const byDateMap = new Map<string, { registered: number; attended: number }>();
            students.forEach(s => {
                const date = s.exam_date;
                if (!date) return;
                if (!byDateMap.has(date)) byDateMap.set(date, { registered: 0, attended: 0 });
                const agg = byDateMap.get(date)!;
                agg.registered += 1;
                const attended = s.math_grade !== null && s.portuguese_grade !== null; // Heurística de presença: ambas as notas lançadas
                if (attended) agg.attended += 1;
            });

            // Montar resultado apenas para datas passadas existentes
            const stats = pastExamDates.map(ed => {
                const agg = byDateMap.get(ed.exam_date) || { registered: 0, attended: 0 };
                const rate = agg.registered > 0 ? (agg.attended / agg.registered) * 100 : 0;
                return {
                    exam_date: ed.exam_date,
                    unit_name: ed.units?.name || 'Unidade',
                    registered: agg.registered,
                    attended: agg.attended,
                    attendance_rate: rate,
                };
            })
            // Mostrar apenas datas com pelo menos um inscrito ou algum comparecimento
            .filter(item => item.registered > 0 || item.attended > 0)
            .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

            setExamAttendanceStats(stats);
        } catch (error) {
            console.error('Erro ao calcular presença em provas:', error);
            setExamAttendanceStats([]);
        }
    };

    // Filtrar turmas baseado na unidade selecionada
    useEffect(() => {
        if (selectedUnitId === 'all') {
            setFilteredClasses(classes);
        } else {
            setFilteredClasses(classes.filter(cls => cls.unit_id === selectedUnitId));
        }
        // Reset class selection when unit changes
        if (selectedClassId !== 'all') {
            setSelectedClassId('all');
        }
    }, [selectedUnitId, classes]);

    // Função para aplicar filtros nas queries
    const applyFilters = (query: any) => {
        // Sempre filtrar por ano letivo atual
        const currentAcademicYear = getCurrentAcademicYear();
        console.log('🔍 Debug Relatórios Avançados:');
        console.log('📅 Data atual:', new Date().toLocaleDateString());
        console.log('📚 Ano letivo calculado:', currentAcademicYear);
        
        query = query.eq('ano_letivo', parseInt(currentAcademicYear));
        
        if (selectedUnitId !== 'all') {
            query = query.eq('unit_id', selectedUnitId);
        }
        if (selectedClassId !== 'all') {
            query = query.eq('class_id', selectedClassId);
        }
        return query;
    };

    // Função: tempo médio entre cadastro e matrícula (em dias)
    const fetchAverageTimeToEnrollment = async () => {
        try {
            // Buscar alunos matriculados com datas de criação/atualização
            let studentsQuery = supabase
                .from('students')
                .select('id, created_at, updated_at')
                .eq('status', 'matriculado');

            studentsQuery = applyFilters(studentsQuery);

            const { data: studentsData, error: studentsError } = await studentsQuery;
            if (studentsError) {
                console.error('Erro ao buscar alunos para tempo de matrícula:', studentsError);
                setAverageEnrollmentTimeDays(0);
                return;
            }

            const students = (studentsData || []) as Array<{ id: string; created_at: string | null; updated_at: string | null }>;
            if (students.length === 0) {
                setAverageEnrollmentTimeDays(0);
                return;
            }

            const studentIds = students.map(s => s.id);
            // Buscar interações de matrícula (se existirem) para obter data precisa
            const { data: interactionsData, error: interactionsError } = await supabase
                .from('student_interactions')
                .select('student_id, created_at')
                .eq('interaction_type', 'matricula')
                .in('student_id', studentIds);

            if (interactionsError) {
                console.error('Erro ao buscar interações de matrícula:', interactionsError);
            }

            // Mapa do primeiro registro de matrícula por aluno
            const firstEnrollmentMap = new Map<string, string>();
            (interactionsData || []).forEach((it: any) => {
                const prev = firstEnrollmentMap.get(it.student_id);
                if (!prev || new Date(it.created_at) < new Date(prev)) {
                    firstEnrollmentMap.set(it.student_id, it.created_at);
                }
            });

            // Calcular diferença em dias: (data_matricula - created_at)
            let totalDays = 0;
            let count = 0;
            students.forEach(s => {
                const createdAt = s.created_at ? new Date(s.created_at) : null;
                // Preferir data da interação de matrícula; fallback para updated_at
                const enrollmentAtStr = firstEnrollmentMap.get(s.id) || s.updated_at || null;
                const enrollmentAt = enrollmentAtStr ? new Date(enrollmentAtStr) : null;
                if (createdAt && enrollmentAt && enrollmentAt >= createdAt) {
                    const diffMs = enrollmentAt.getTime() - createdAt.getTime();
                    const diffDays = diffMs / (1000 * 60 * 60 * 24);
                    totalDays += diffDays;
                    count += 1;
                }
            });

            const avgDays = count > 0 ? totalDays / count : 0;
            setAverageEnrollmentTimeDays(avgDays);
        } catch (error) {
            console.error('Erro ao calcular tempo médio entre cadastro e matrícula:', error);
            setAverageEnrollmentTimeDays(0);
        }
    };

    // Função: motivos de desistência (contagem e porcentagem)
    const fetchDropoutReasonsStats = async () => {
        try {
            let query = supabase
                .from('students')
                .select('id, dropout_reason')
                .eq('status', 'desistente');

            query = applyFilters(query);

            const { data, error } = await query;
            if (error) {
                console.error('Erro ao buscar desistentes:', error);
                setDropoutReasonStats([]);
                return;
            }

            const desistentes = (data || []) as Array<{ id: string; dropout_reason: string | null }>;
            if (desistentes.length === 0) {
                setDropoutReasonStats([]);
                return;
            }

            const total = desistentes.length;
            const counts = new Map<string, number>();
            desistentes.forEach(d => {
                const reason = d.dropout_reason || 'outro';
                counts.set(reason, (counts.get(reason) || 0) + 1);
            });

            const labelMap: Record<string, string> = {
                impossibilidade_contato: 'Impossibilidade de contato',
                mudanca_de_endereco: 'Mudança de endereço',
                matriculou_outra_escola: 'Matriculou-se em outra escola',
                motivos_financeiros: 'Motivos financeiros',
                falta_vaga: 'Falta de vaga',
                outro: 'Outro',
            };

            const stats = Array.from(counts.entries())
                .map(([reason, count]) => ({
                    reason: labelMap[reason] || reason,
                    count,
                    percentage: total > 0 ? (count / total) * 100 : 0,
                }))
                .sort((a, b) => b.count - a.count);

            setDropoutReasonStats(stats);
        } catch (error) {
            console.error('Erro ao calcular motivos de desistência:', error);
            setDropoutReasonStats([]);
        }
    };

    // Função: número de contatos feitos por atendente
    const fetchContactsPerAttendant = async () => {
        try {
            // IDs de alunos filtrados (excluindo estados indesejados)
            let studentsQuery = supabase
                .from('students')
                .select('id, status');

            studentsQuery = applyFilters(studentsQuery)
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');

            const { data: studentsData, error: studentsError } = await studentsQuery;
            if (studentsError) {
                console.error('Erro ao buscar alunos para contatos por atendente:', studentsError);
                setContactsByAttendant([]);
                return;
            }

            const studentIds = (studentsData || []).map((s: any) => s.id);
            if (studentIds.length === 0) {
                setContactsByAttendant([]);
                return;
            }

            // Buscar tentativas de contato dos alunos filtrados, agrupadas por atendente
            const { data: attempts, error: attemptsError } = await supabase
                .from('contact_attempts')
                .select(`attempted_by, student_id, profiles!contact_attempts_attempted_by_fkey (name)`)
                .in('student_id', studentIds);

            if (attemptsError) {
                console.error('Erro ao buscar tentativas de contato por atendente:', attemptsError);
                setContactsByAttendant([]);
                return;
            }

            const byAttendant = new Map<string, { name: string; total: number }>();
            (attempts || []).forEach((a: any) => {
                const id = a.attempted_by || 'desconhecido';
                const name = a.profiles?.name || 'Atendente desconhecido';
                if (!byAttendant.has(id)) byAttendant.set(id, { name, total: 0 });
                const agg = byAttendant.get(id)!;
                agg.total += 1;
            });

            const stats = Array.from(byAttendant.values())
                .map(a => ({ attendant_name: a.name, total: a.total }))
                .sort((a, b) => b.total - a.total);

            setContactsByAttendant(stats);
        } catch (error) {
            console.error('Erro ao calcular contatos por atendente:', error);
            setContactsByAttendant([]);
        }
    };

    const fetchConversionRate = async () => {
        try {
            // Query base para total de estudantes (excluindo cadastro_invalido e processo_anos_anteriores)
            let totalQuery = supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');
            
            // Query base para estudantes matriculados
            let enrolledQuery = supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'matriculado');

            // Aplicar filtros
            totalQuery = applyFilters(totalQuery);
            enrolledQuery = applyFilters(enrolledQuery);

            const [totalResult, enrolledResult] = await Promise.all([
                totalQuery,
                enrolledQuery
            ]);

            if (totalResult.error || enrolledResult.error) {
                console.error('Error fetching student counts:', totalResult.error || enrolledResult.error);
                return;
            }

            const totalStudents = totalResult.count ?? 0;
            const enrolledStudents = enrolledResult.count ?? 0;

            if (totalStudents > 0) {
                const rate = (enrolledStudents / totalStudents) * 100;
                setConversionRate(rate);
            } else {
                setConversionRate(0);
            }
        } catch (error) {
            console.error('Erro ao calcular taxa de conversão:', error);
            setConversionRate(0);
        }
    };

    const fetchAverageDiscount = async () => {
        try {
            // Buscar todos os alunos matriculados com desconto
            let query = supabase
                .from('students')
                .select('discount_percentage')
                .eq('status', 'matriculado')
                .not('discount_percentage', 'is', null);
            
            // Aplicar filtros
            query = applyFilters(query);
            
            const { data: enrolledStudents, error } = await query;

            if (error) {
                console.error('Erro ao buscar descontos:', error);
                return;
            }

            if (!enrolledStudents || enrolledStudents.length === 0) {
                setAverageDiscount(0);
                return;
            }

            // Calcular média dos descontos
            const totalDiscount = enrolledStudents.reduce((sum, student) => {
                return sum + (student.discount_percentage || 0);
            }, 0);

            const avgDiscount = totalDiscount / enrolledStudents.length;
            setAverageDiscount(avgDiscount);

        } catch (error) {
            console.error('Erro ao calcular desconto médio:', error);
            setAverageDiscount(0);
        }
    };

    const fetchAverageMonthlyFee = async () => {
        try {
            // Buscar alunos matriculados com dados da turma
            let query = supabase
                .from('students')
                .select(`
                    discount_percentage,
                    classes (
                        monthly_fee
                    )
                `)
                .eq('status', 'matriculado');
            
            // Aplicar filtros
            query = applyFilters(query);
            
            const { data: enrolledStudents, error } = await query;

            if (error) {
                console.error('Erro ao buscar dados de mensalidade:', error);
                return;
            }

            if (!enrolledStudents || enrolledStudents.length === 0) {
                setAverageMonthlyFee(0);
                return;
            }

            // Calcular mensalidade média com desconto aplicado
            let totalFeeWithDiscount = 0;
            let validStudents = 0;

            enrolledStudents.forEach(student => {
                if (student.classes?.monthly_fee) {
                    const originalFee = student.classes.monthly_fee;
                    const discountPercentage = student.discount_percentage || 0;
                    const discountMultiplier = 1 - (discountPercentage / 100);
                    const finalFee = originalFee * discountMultiplier;
                    
                    totalFeeWithDiscount += finalFee;
                    validStudents++;
                }
            });

            if (validStudents > 0) {
                const avgFee = totalFeeWithDiscount / validStudents;
                setAverageMonthlyFee(avgFee);
            } else {
                setAverageMonthlyFee(0);
            }

        } catch (error) {
            console.error('Erro ao calcular mensalidade média:', error);
            setAverageMonthlyFee(0);
        }
    };

    const fetchInterviewerConversion = async () => {
        try {
            // Buscar interações de atendimento para contar o total real de atendimentos por entrevistador
            let interactionsQuery = supabase
                .from('student_interactions')
                .select(`
                    user_id,
                    student_id,
                    profiles!student_interactions_user_id_fkey (
                        id,
                        name
                    ),
                    students (
                        id,
                        status,
                        unit_id,
                        class_id
                    )
                `)
                .eq('interaction_type', 'atendimento');

            const { data: interactions, error: interactionsError } = await interactionsQuery;

            if (interactionsError) {
                console.error('Erro ao buscar dados de interações:', interactionsError);
                return;
            }

            if (!interactions || interactions.length === 0) {
                setInterviewerStats([]);
                return;
            }

            // Filtrar interações baseado nos filtros selecionados e excluir status indesejados
            const filteredInteractions = interactions.filter(interaction => {
                if (!interaction.students) return false;
                
                // Excluir alunos com status cadastro_invalido e processo_anos_anteriores
                if (interaction.students.status === 'cadastro_invalido' || 
                    interaction.students.status === 'processo_anos_anteriores') {
                    return false;
                }
                
                if (selectedUnitId !== 'all' && interaction.students.unit_id !== selectedUnitId) {
                    return false;
                }
                
                if (selectedClassId !== 'all' && interaction.students.class_id !== selectedClassId) {
                    return false;
                }
                
                return true;
            });

            // Agrupar alunos por entrevistador baseado em student_interactions
            const interviewerMap = new Map();

            filteredInteractions.forEach(interaction => {
                const interviewerId = interaction.user_id; // user_id da interação
                const interviewerName = interaction.profiles?.name || 'Entrevistador desconhecido';
                const studentId = interaction.student_id;
                const isEnrolled = interaction.students?.status === 'matriculado';

                if (!interviewerMap.has(interviewerId)) {
                    interviewerMap.set(interviewerId, {
                        name: interviewerName,
                        total: 0, // Total de atendimentos reais (baseado em student_interactions)
                        enrolledStudents: new Set(), // Set para alunos únicos matriculados
                        totalStudents: new Set() // Set para alunos únicos atendidos
                    });
                }

                const stats = interviewerMap.get(interviewerId);
                stats.total += 1; // Conta cada interação de atendimento
                stats.totalStudents.add(studentId); // Adiciona aluno único ao total
                
                if (isEnrolled) {
                    stats.enrolledStudents.add(studentId); // Adiciona aluno único matriculado
                }
            });

            // Calcular conversão e ordenar por taxa
            const interviewerStats = Array.from(interviewerMap.values())
                .map(stats => ({
                    name: stats.name,
                    total: stats.total, // Total de atendimentos reais
                    enrolled: stats.enrolledStudents.size, // Total de alunos únicos matriculados
                    conversion: stats.totalStudents.size > 0 ? (stats.enrolledStudents.size / stats.totalStudents.size) * 100 : 0
                }))
                .filter(stats => stats.total >= 3) // Só mostrar entrevistadores com pelo menos 3 atendimentos
                .sort((a, b) => b.conversion - a.conversion)
                .slice(0, 5); // Top 5 entrevistadores

            setInterviewerStats(interviewerStats);

        } catch (error) {
            console.error('Erro ao calcular conversão por entrevistador:', error);
            setInterviewerStats([]);
        }
    };

    const fetchInterviewStats = async () => {
        try {
            // Buscar entrevistas marcadas (alunos com interview_date, excluindo cadastro_invalido e processo_anos_anteriores)
            let scheduledQuery = supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .not('interview_date', 'is', null)
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');
            
            // Buscar entrevistas realizadas através de student_interactions
            // Contar alunos únicos que tiveram interação do tipo "atendimento"
            let completedQuery = supabase
                .from('student_interactions')
                .select('student_id')
                .eq('interaction_type', 'atendimento');
            
            // Aplicar filtros para entrevistas marcadas
            scheduledQuery = applyFilters(scheduledQuery);

            const [scheduledResult, completedResult] = await Promise.all([
                scheduledQuery,
                completedQuery
            ]);

            if (scheduledResult.error || completedResult.error) {
                console.error('Erro ao buscar estatísticas de entrevistas:', scheduledResult.error || completedResult.error);
                return;
            }

            const scheduled = scheduledResult.count ?? 0;
            
            // Para entrevistas realizadas, precisamos aplicar filtros adicionais
            // pois student_interactions não tem unit_id/class_id diretamente
            let completedCount = 0;
            
            if (completedResult.data && completedResult.data.length > 0) {
                // Se há filtros aplicados, precisamos verificar se os alunos das interações
                // pertencem às unidades/turmas selecionadas
                if (selectedUnitId !== 'all' || selectedClassId !== 'all') {
                    const studentIds = [...new Set(completedResult.data.map(item => item.student_id))];
                    
                    let studentsQuery = supabase
                        .from('students')
                        .select('id, unit_id, class_id')
                        .in('id', studentIds);
                    
                    studentsQuery = applyFilters(studentsQuery);
                    
                    const { data: filteredStudents, error: studentsError } = await studentsQuery;
                    
                    if (studentsError) {
                        console.error('Erro ao filtrar alunos das interações:', studentsError);
                        completedCount = 0;
                    } else {
                        completedCount = filteredStudents?.length || 0;
                    }
                } else {
                    // Sem filtros, contar alunos únicos das interações
                    completedCount = new Set(completedResult.data.map(item => item.student_id)).size;
                }
            }

            const rate = scheduled > 0 ? (completedCount / scheduled) * 100 : 0;

            setScheduledInterviews(scheduled);
            setCompletedInterviews(completedCount);
            setInterviewCompletionRate(rate);

        } catch (error) {
            console.error('Erro ao calcular estatísticas de entrevistas:', error);
            setScheduledInterviews(0);
            setCompletedInterviews(0);
            setInterviewCompletionRate(0);
        }
    };

    const fetchRegistrationSources = async () => {
        try {
            // Buscar dados de origens de inscrição com contagem de alunos usando a nova estrutura
            let query = (supabase as any)
                .from('students')
                .select(`
                    registration_source_id,
                    status,
                    unit_registration_source_associations!students_registration_source_id_fkey (
                        id,
                        custom_label,
                        global_registration_sources!inner (
                            source_label
                        )
                    )
                `)
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)')
                .not('registration_source_id', 'is', null);
            
            // Aplicar filtros
            query = applyFilters(query);
            
            const { data: students, error } = await query;

            if (error) {
                console.error('Erro ao buscar origens de inscrição:', error);
                setRegistrationSources([]);
                return;
            }

            if (!students || students.length === 0) {
                setRegistrationSources([]);
                return;
            }

            // Agrupar por origem e calcular estatísticas
            const sourceMap = new Map();

            students.forEach((student: any) => {
                // Usar custom_label se disponível, senão usar o label global
                const sourceLabel = student.unit_registration_source_associations?.custom_label || 
                                  student.unit_registration_source_associations?.global_registration_sources?.source_label || 
                                  'Origem não identificada';
                const isEnrolled = student.status === 'matriculado';

                if (!sourceMap.has(sourceLabel)) {
                    sourceMap.set(sourceLabel, {
                        source_label: sourceLabel,
                        total_students: 0,
                        enrolled_students: 0
                    });
                }

                const stats = sourceMap.get(sourceLabel);
                stats.total_students += 1;
                
                if (isEnrolled) {
                    stats.enrolled_students += 1;
                }
            });

            // Calcular percentuais e taxa de conversão
            const totalStudents = students.length;
            const sourceStats = Array.from(sourceMap.values())
                .map(stats => ({
                    ...stats,
                    percentage: totalStudents > 0 ? (stats.total_students / totalStudents) * 100 : 0,
                    conversion_rate: stats.total_students > 0 ? (stats.enrolled_students / stats.total_students) * 100 : 0
                }))
                .sort((a, b) => b.total_students - a.total_students); // Ordenar por total de alunos

            setRegistrationSources(sourceStats);

            let totalValidQuery = supabase
                .from('students')
                .select('id', { count: 'exact', head: true })
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');
            totalValidQuery = applyFilters(totalValidQuery);
            const { count: totalValidCount } = await totalValidQuery;
            const nonAccounted = (totalValidCount || 0) - totalStudents;
            setRegistrationSourcesPie({
                data: [
                    ...sourceStats.map(s => ({ name: s.source_label, value: s.total_students })),
                    ...(nonAccounted > 0 ? [{ name: 'Não contabilizado', value: nonAccounted }] : [])
                ]
            });

        } catch (error) {
            console.error('Erro ao calcular estatísticas de origens:', error);
            setRegistrationSources([]);
        }
    };

    // Função para buscar estatísticas de tracking codes
    const fetchTrackingSources = async () => {
        try {
            // Buscar todos os estudantes com tracking_code
            let query = supabase
                .from('students')
                .select('tracking_code, status')
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');

            // Aplicar filtros
            query = applyFilters(query);

            const { data: students, error } = await query;

            if (error) {
                console.error('Erro ao buscar dados de tracking:', error);
                return;
            }

            // Filtrar apenas estudantes com tracking_code
            const studentsWithTracking = students?.filter(student => student.tracking_code && student.tracking_code.trim() !== '') || [];

            // Agrupar por tracking_code
            const trackingMap = new Map();

            studentsWithTracking.forEach((student: any) => {
                const trackingCode = student.tracking_code;
                const isEnrolled = student.status === 'matriculado';

                if (!trackingMap.has(trackingCode)) {
                    trackingMap.set(trackingCode, {
                        tracking_code: trackingCode,
                        total_students: 0,
                        enrolled_students: 0
                    });
                }

                const stats = trackingMap.get(trackingCode);
                stats.total_students++;
                if (isEnrolled) {
                    stats.enrolled_students++;
                }
            });

            // Calcular percentuais e taxa de conversão
            const totalStudents = studentsWithTracking.length;
            const trackingStats = Array.from(trackingMap.values())
                .map(stats => ({
                    ...stats,
                    percentage: totalStudents > 0 ? (stats.total_students / totalStudents) * 100 : 0,
                    conversion_rate: stats.total_students > 0 ? (stats.enrolled_students / stats.total_students) * 100 : 0
                }))
                .sort((a, b) => b.total_students - a.total_students); // Ordenar por total de alunos

            setTrackingSources(trackingStats);

            let totalValidQuery = supabase
                .from('students')
                .select('id', { count: 'exact', head: true })
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');
            totalValidQuery = applyFilters(totalValidQuery);
            const { count: totalValidCount } = await totalValidQuery;
            const nonAccounted = (totalValidCount || 0) - totalStudents;
            setTrackingSourcesPie({
                data: [
                    ...trackingStats.map(s => ({ name: s.tracking_code, value: s.total_students })),
                    ...(nonAccounted > 0 ? [{ name: 'Não contabilizado', value: nonAccounted }] : [])
                ]
            });

        } catch (error) {
            console.error('Erro ao calcular estatísticas de tracking:', error);
            setTrackingSources([]);
        }
    };

    // Função: estatísticas de tentativas de contato por canal e motivo
    const fetchContactAttemptStats = async () => {
        try {
            // IDs de alunos filtrados (excluindo estados indesejados)
            let studentsQuery = supabase
                .from('students')
                .select('id, status');

            studentsQuery = applyFilters(studentsQuery)
                .not('status', 'in', '(cadastro_invalido,processo_anos_anteriores)');

            const { data: studentsData, error: studentsError } = await studentsQuery;
            if (studentsError) {
                console.error('Erro ao buscar alunos para tentativas:', studentsError);
                setContactsByChannel([]);
                setContactsByReason([]);
                return;
            }

            const studentIds = (studentsData || []).map((s: any) => s.id);
            if (studentIds.length === 0) {
                setContactsByChannel([]);
                setContactsByReason([]);
                return;
            }

            // Buscar tentativas de contato para os alunos filtrados
            const { data: attempts, error: attemptsError } = await supabase
                .from('contact_attempts')
                .select('student_id, channel, reason, succeeded')
                .in('student_id', studentIds);

            if (attemptsError) {
                console.error('Erro ao buscar tentativas de contato:', attemptsError);
                setContactsByChannel([]);
                setContactsByReason([]);
                return;
            }

            // Agregação por canal e motivo
            const byChannelMap = new Map<string, { total: number; succeeded: number }>();
            const byReasonMap = new Map<string, { total: number; succeeded: number }>();

            (attempts || []).forEach((a: any) => {
                const ch = String(a.channel);
                const rsn = a.reason ? String(a.reason) : 'sem_motivo';
                const succ = a.succeeded ? 1 : 0;

                if (!byChannelMap.has(ch)) byChannelMap.set(ch, { total: 0, succeeded: 0 });
                const chAgg = byChannelMap.get(ch)!;
                chAgg.total += 1;
                chAgg.succeeded += succ;

                if (!byReasonMap.has(rsn)) byReasonMap.set(rsn, { total: 0, succeeded: 0 });
                const rsnAgg = byReasonMap.get(rsn)!;
                rsnAgg.total += 1;
                rsnAgg.succeeded += succ;
            });

            const contactsByChannel = Array.from(byChannelMap.entries())
                .map(([channel, agg]) => ({ channel, ...agg }))
                .sort((a, b) => b.total - a.total);

            const contactsByReason = Array.from(byReasonMap.entries())
                .map(([reason, agg]) => ({ reason, ...agg }))
                .sort((a, b) => b.total - a.total);

            setContactsByChannel(contactsByChannel);
            setContactsByReason(contactsByReason);
        } catch (error) {
            console.error('Erro ao calcular estatísticas de tentativas de contato:', error);
            setContactsByChannel([]);
            setContactsByReason([]);
        }
    };

    // Função: média de tentativas por aluno matriculado
    const fetchAverageContactsPerEnrolled = async () => {
        try {
            // IDs de alunos matriculados (filtrados)
            let enrolledQuery = supabase
                .from('students')
                .select('id')
                .eq('status', 'matriculado');

            enrolledQuery = applyFilters(enrolledQuery);

            const { data: enrolledIdsData, error: enrolledError } = await enrolledQuery;
            if (enrolledError) {
                console.error('Erro ao buscar alunos matriculados:', enrolledError);
                setAvgContactsPerEnrolled(0);
                return;
            }

            const enrolledIds = (enrolledIdsData || []).map((s: any) => s.id);
            if (enrolledIds.length === 0) {
                setAvgContactsPerEnrolled(0);
                return;
            }

            // Buscar tentativas para esses alunos
            const { data: attempts, error: attemptsError } = await supabase
                .from('contact_attempts')
                .select('student_id')
                .in('student_id', enrolledIds);

            if (attemptsError) {
                console.error('Erro ao buscar tentativas para matriculados:', attemptsError);
                setAvgContactsPerEnrolled(0);
                return;
            }

            const counts = new Map<string, number>();
            enrolledIds.forEach((id: string) => counts.set(id, 0));
            (attempts || []).forEach((a: any) => {
                const prev = counts.get(a.student_id) || 0;
                counts.set(a.student_id, prev + 1);
            });

            const totalAttempts = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
            const avg = totalAttempts / enrolledIds.length;

            setAvgContactsPerEnrolled(avg);
        } catch (error) {
            console.error('Erro ao calcular média de contatos por matriculado:', error);
            setAvgContactsPerEnrolled(0);
        }
    };

    // Função para buscar todos os dados
    const fetchAllData = () => {
        fetchConversionRate();
        fetchAverageDiscount();
        fetchAverageMonthlyFee();
        fetchInterviewerConversion();
        fetchInterviewStats(); // Adicionado para buscar estatísticas de entrevistas
        fetchRegistrationSources(); // Adicionado para buscar estatísticas de origens
        fetchTrackingSources(); // Adicionado para buscar estatísticas de tracking
        fetchContactAttemptStats(); // Tentativas por canal/motivo
        fetchAverageContactsPerEnrolled(); // Média por aluno matriculado
        fetchExamAttendanceStats(); // Presença em provas (datas passadas)
        fetchAverageTimeToEnrollment(); // Tempo médio entre cadastro e matrícula
        fetchDropoutReasonsStats(); // Motivos de desistência
        fetchContactsPerAttendant(); // Contatos por atendente
    };

    // Effect inicial para buscar dados básicos
    useEffect(() => {
        fetchUnits();
        fetchClasses();
    }, []);

    // Effect para atualizar dados quando filtros mudarem
    useEffect(() => {
        if (units.length > 0 && classes.length > 0) {
            fetchAllData();
        }
    }, [selectedUnitId, selectedClassId, units.length, classes.length]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Relatórios Avançados</h2>
        <p className="text-gray-600">Análises detalhadas a nível gerencial</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione unidade e/ou turma para análise específica</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Unidade
              </label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Turma
              </label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as turmas" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {filteredClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} - {(cls as any).series?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button 
                onClick={fetchAllData} 
                variant="outline" 
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversão de Matrículas</CardTitle>
            <CardDescription>Taxa de conversão por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(2)}%</div>
            <p className="text-sm text-muted-foreground">Conversão de referência: 25%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desconto Médio</CardTitle>
            <CardDescription>Percentual médio de desconto concedido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageDiscount.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">
              {averageDiscount > 0 ? 'Baseado em alunos matriculados' : 'Nenhum desconto aplicado'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensalidade Média</CardTitle>
            <CardDescription>Valor médio após descontos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageMonthlyFee > 0 ? `R$ ${averageMonthlyFee.toFixed(0)}` : 'R$ 0'}
            </div>
            <p className="text-sm text-muted-foreground">
              {averageMonthlyFee > 0 ? 'Valor após aplicação de descontos' : 'Nenhum aluno matriculado'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Estatísticas de Entrevistas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Entrevistas Marcadas</CardTitle>
            <CardDescription>Alunos com data de entrevista definida</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledInterviews}</div>
            <p className="text-sm text-muted-foreground">Data de entrevista preenchida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrevistas Realizadas</CardTitle>
            <CardDescription>Alunos com desconto/atendimento registrado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedInterviews}</div>
            <p className="text-sm text-muted-foreground">Campo discount_percentage preenchido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxa de Realização</CardTitle>
            <CardDescription>Percentual de entrevistas efetivadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interviewCompletionRate.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Realizadas ÷ Marcadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Presença em Provas (Datas Passadas) */}
      <Card>
        <CardHeader>
          <CardTitle>Presença em Provas (Datas Passadas)</CardTitle>
          <CardDescription>Inscritos vs comparecimentos por data de exame</CardDescription>
        </CardHeader>
        <CardContent>
          {examAttendanceStats.length > 0 ? (
            <div className="space-y-3">
              {examAttendanceStats.map(item => (
                <div key={`${item.exam_date}-${item.unit_name}`} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {new Date(item.exam_date + 'T00:00:00').toLocaleDateString('pt-BR')} • {item.unit_name}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {item.registered} inscritos • {item.attended} comparecimentos
                      </div>
                    </div>
                    <div className={`text-lg font-semibold ${
                      item.attendance_rate >= 70 ? 'text-green-600' : item.attendance_rate >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {item.attendance_rate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${item.registered > 0 ? (item.attended / item.registered) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma presença registrada para datas passadas</p>
          )}
        </CardContent>
      </Card>

      {/* Tempo médio entre cadastro e matrícula */}
      <Card>
        <CardHeader>
          <CardTitle>Tempo Médio até Matrícula</CardTitle>
          <CardDescription>Dias entre cadastro e matrícula</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageEnrollmentTimeDays.toFixed(1)} dias</div>
          <p className="text-sm text-muted-foreground">Baseado em interações de matrícula e última atualização</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversão por Entrevistador</CardTitle>
          <CardDescription>Performance individual dos entrevistadores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {interviewerStats.length > 0 ? (
              interviewerStats.map((interviewer, index) => (
                <div key={interviewer.name} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div className="flex flex-col">
                    <span className="font-medium">{interviewer.name}</span>
                    <span className="text-xs text-gray-500">
                      {interviewer.enrolled}/{interviewer.total} alunos
                    </span>
                  </div>
                  <span className={`font-semibold ${
                    interviewer.conversion >= 70 ? 'text-green-600' : 
                    interviewer.conversion >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {interviewer.conversion.toFixed(1)}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">
                Nenhum dado de entrevistador disponível
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Motivos de Desistência */}
      <Card>
        <CardHeader>
          <CardTitle>Motivos de Desistência</CardTitle>
          <CardDescription>Distribuição dos motivos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {dropoutReasonStats.length > 0 ? (
            <div className="space-y-3">
              {dropoutReasonStats.map((item) => (
                <div key={item.reason} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{item.reason}</span>
                    <span className="text-sm text-gray-600">{item.count} ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhum caso de desistência encontrado</p>
          )}
        </CardContent>
      </Card>

      {/* Contatos por Atendente */}
      <Card>
        <CardHeader>
          <CardTitle>Contatos por Atendente</CardTitle>
          <CardDescription>Número de tentativas registradas por atendente</CardDescription>
        </CardHeader>
        <CardContent>
          {contactsByAttendant.length > 0 ? (
            <div className="space-y-3">
              {contactsByAttendant.map((att) => (
                <div key={att.attendant_name} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">{att.attendant_name}</span>
                  <span className="text-sm text-gray-700">{att.total} contatos</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhuma tentativa encontrada</p>
          )}
        </CardContent>
      </Card>

      {/* Relatório de Contatos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Média de Contatos por Matrícula</CardTitle>
            <CardDescription>Tentativas médias por aluno matriculado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgContactsPerEnrolled.toFixed(1)}</div>
            <p className="text-sm text-muted-foreground">Inclui alunos com 0 tentativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contatos por Canal</CardTitle>
            <CardDescription>Tentativas e sucesso por canal</CardDescription>
          </CardHeader>
          <CardContent>
            {contactsByChannel.length > 0 ? (
              <div className="space-y-3">
                {contactsByChannel.map((item) => (
                  <div key={item.channel} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium capitalize">{item.channel}</span>
                      <span className="text-sm text-gray-600">
                        {item.succeeded}/{item.total} com sucesso
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${item.total > 0 ? (item.succeeded / item.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhuma tentativa encontrada</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contatos por Motivo</CardTitle>
            <CardDescription>Tentativas e sucesso por motivo</CardDescription>
          </CardHeader>
          <CardContent>
            {contactsByReason.length > 0 ? (
              <div className="space-y-3">
                {contactsByReason.map((item) => (
                  <div key={item.reason} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium capitalize">{item.reason}</span>
                      <span className="text-sm text-gray-600">
                        {item.succeeded}/{item.total} com sucesso
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${item.total > 0 ? (item.succeeded / item.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhuma tentativa encontrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Relatório de Origens de Inscrição */}
      <Card>
        <CardHeader>
          <CardTitle>Origens de Inscrição</CardTitle>
          <CardDescription>Análise de canais de captação de alunos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {registrationSources.length > 0 ? (
              <Tabs defaultValue="lista" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="lista">Lista</TabsTrigger>
                  <TabsTrigger value="pizza">Gráfico de Pizza</TabsTrigger>
                </TabsList>
                <TabsContent value="lista">
                {/* Resumo geral */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {registrationSources.length}
                    </div>
                    <div className="text-sm text-blue-600">Canais Ativos</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {registrationSources.reduce((sum, source) => sum + source.total_students, 0)}
                    </div>
                    <div className="text-sm text-green-600">Total de Inscrições</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {registrationSources.reduce((sum, source) => sum + source.enrolled_students, 0)}
                    </div>
                    <div className="text-sm text-purple-600">Alunos Matriculados</div>
                  </div>
                </div>

                {/* Lista detalhada */}
                <div className="space-y-3">
                  {registrationSources.map((source, index) => (
                    <div key={source.source_label} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{source.source_label}</h4>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-sm text-gray-600">
                              {source.total_students} inscrições ({source.percentage.toFixed(1)}%)
                            </span>
                            <span className="text-sm text-gray-600">
                              {source.enrolled_students} matriculados
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            source.conversion_rate >= 70 ? 'text-green-600' : 
                            source.conversion_rate >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {source.conversion_rate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">Taxa de Conversão</div>
                        </div>
                      </div>
                      
                      {/* Barra de progresso */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${source.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
                </TabsContent>
                <TabsContent value="pizza">
                  <PieSection
                    title="Distribuição de Origens"
                    data={registrationSourcesPie.data}
                    labelKey="name"
                    valueKey="value"
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="text-lg font-medium mb-2">Nenhum dado de origem disponível</div>
                <div className="text-sm">
                  Configure origens de inscrição nas configurações para ver este relatório
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relatório de Tracking Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Relatório de Fontes de Inscrições</CardTitle>
          <CardDescription>
            Análise de cadastros e matrículas por código de fonte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trackingSources.length > 0 ? (
              <Tabs defaultValue="lista" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="lista">Lista</TabsTrigger>
                  <TabsTrigger value="pizza">Gráfico de Pizza</TabsTrigger>
                </TabsList>
                <TabsContent value="lista">
                {/* Resumo geral */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {trackingSources.length}
                    </div>
                    <div className="text-sm text-blue-600">Códigos Ativos</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {trackingSources.reduce((sum, source) => sum + source.total_students, 0)}
                    </div>
                    <div className="text-sm text-green-600">Total de Alunos com Código</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {trackingSources.reduce((sum, source) => sum + source.enrolled_students, 0)}
                    </div>
                    <div className="text-sm text-purple-600">Alunos Matriculados</div>
                  </div>
                </div>

                {/* Lista detalhada */}
                <div className="space-y-3">
                  {trackingSources.map((source, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            Código: {source.tracking_code}
                          </h4>
                          <div className="text-sm text-gray-600 mt-1">
                            {source.total_students} cadastros • {source.enrolled_students} matriculados
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {source.conversion_rate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">conversão</div>
                        </div>
                      </div>
                      
                      {/* Barra de progresso */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${source.percentage}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{source.percentage.toFixed(1)}% do total rastreado</span>
                        <span>
                          {source.enrolled_students}/{source.total_students} matriculados
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                </TabsContent>
                <TabsContent value="pizza">
                  <PieSection
                    title="Distribuição por Fontes"
                    data={trackingSourcesPie.data}
                    labelKey="name"
                    valueKey="value"
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="text-lg font-medium mb-2">Nenhum código de tracking encontrado</div>
                <div className="text-sm">
                  Adicione códigos de tracking aos cadastros para ver este relatório
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
