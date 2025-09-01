
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

export const AdvancedReportsTab = () => {
    const [conversionRate, setConversionRate] = useState(0);
    const [averageDiscount, setAverageDiscount] = useState(0);
    const [averageMonthlyFee, setAverageMonthlyFee] = useState(0);
    const [interviewerStats, setInterviewerStats] = useState<Array<{name: string, conversion: number, total: number, enrolled: number}>>([]);
    
    // Estados dos filtros
    const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const [units, setUnits] = useState<Tables<'units'>[]>([]);
    const [classes, setClasses] = useState<Tables<'classes'>[]>([]);
    const [filteredClasses, setFilteredClasses] = useState<Tables<'classes'>[]>([]);

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
        if (selectedUnitId !== 'all') {
            query = query.eq('unit_id', selectedUnitId);
        }
        if (selectedClassId !== 'all') {
            query = query.eq('class_id', selectedClassId);
        }
        return query;
    };

    const fetchConversionRate = async () => {
        try {
            // Query base para total de estudantes
            let totalQuery = supabase
                .from('students')
                .select('*', { count: 'exact', head: true });
            
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
            // Buscar agendamentos para obter relação entrevistador-aluno
            let query = supabase
                .from('appointments')
                .select(`
                    interviewer_id,
                    student_id,
                    profiles!appointments_interviewer_id_fkey (
                        id,
                        name
                    ),
                    students (
                        id,
                        status,
                        unit_id,
                        class_id
                    )
                `);

            const { data: appointments, error } = await query;

            if (error) {
                console.error('Erro ao buscar dados de agendamentos:', error);
                return;
            }

            if (!appointments || appointments.length === 0) {
                setInterviewerStats([]);
                return;
            }

            // Filtrar appointments baseado nos filtros selecionados
            const filteredAppointments = appointments.filter(appointment => {
                if (!appointment.students) return false;
                
                if (selectedUnitId !== 'all' && appointment.students.unit_id !== selectedUnitId) {
                    return false;
                }
                
                if (selectedClassId !== 'all' && appointment.students.class_id !== selectedClassId) {
                    return false;
                }
                
                return true;
            });

            // Agrupar alunos por entrevistador
            const interviewerMap = new Map();

            filteredAppointments.forEach(appointment => {
                const interviewerId = appointment.interviewer_id;
                const interviewerName = appointment.profiles?.name || 'Entrevistador desconhecido';
                const isEnrolled = appointment.students?.status === 'matriculado';

                if (!interviewerMap.has(interviewerId)) {
                    interviewerMap.set(interviewerId, {
                        name: interviewerName,
                        total: 0,
                        enrolled: 0
                    });
                }

                const stats = interviewerMap.get(interviewerId);
                stats.total += 1;
                if (isEnrolled) {
                    stats.enrolled += 1;
                }
            });

            // Calcular conversão e ordenar por taxa
            const interviewerStats = Array.from(interviewerMap.values())
                .map(stats => ({
                    name: stats.name,
                    total: stats.total,
                    enrolled: stats.enrolled,
                    conversion: stats.total > 0 ? (stats.enrolled / stats.total) * 100 : 0
                }))
                .filter(stats => stats.total >= 3) // Só mostrar entrevistadores com pelo menos 3 entrevistas
                .sort((a, b) => b.conversion - a.conversion)
                .slice(0, 5); // Top 5 entrevistadores

            setInterviewerStats(interviewerStats);

        } catch (error) {
            console.error('Erro ao calcular conversão por entrevistador:', error);
            setInterviewerStats([]);
        }
    };

    // Função para buscar todos os dados
    const fetchAllData = () => {
        fetchConversionRate();
        fetchAverageDiscount();
        fetchAverageMonthlyFee();
        fetchInterviewerConversion();
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
        <p className="text-gray-600">Análises detalhadas para direção e administradores</p>
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
                <SelectContent>
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
                <SelectContent>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-sm text-muted-foreground">Campo interview_date preenchido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrevistas Realizadas</CardTitle>
            <CardDescription>Alunos com desconto/atendimento registrado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-sm text-muted-foreground">Campo discount_percentage preenchido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxa de Realização</CardTitle>
            <CardDescription>Percentual de entrevistas efetivadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-sm text-muted-foreground">Realizadas ÷ Marcadas</p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
};
