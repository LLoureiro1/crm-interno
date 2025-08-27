
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const AdvancedReportsTab = () => {
    const [conversionRate, setConversionRate] = useState(0);

    const fetchConversionRate = async () => {
        // Mock data for now, replace with actual Supabase fetch
        const { count: totalStudents, error: totalError } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true });

        const { count: enrolledStudents, error: enrolledError } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'matriculado');

        if (totalError || enrolledError) {
            console.error('Error fetching student counts:', totalError || enrolledError);
            return;
        }

        if ((totalStudents ?? 0) > 0) {
            const rate = ((enrolledStudents ?? 0) / (totalStudents ?? 0)) * 100;
            setConversionRate(rate);
        } else {
            setConversionRate(0);
        }
    };

    useEffect(() => {
        fetchConversionRate();
    }, []);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Relatórios Avançados</h2>
        <p className="text-gray-600">Análises detalhadas para direção e administradores</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversão de Matrículas</CardTitle>
            <CardDescription>Taxa de conversão por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(2)}%</div>
            <p className="text-sm text-muted-foreground">+2,33% em relação ao mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desconto Médio</CardTitle>
            <CardDescription>Percentual médio de desconto concedido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.5%</div>
            <p className="text-sm text-muted-foreground">Dentro da meta estabelecida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensalidade Média</CardTitle>
            <CardDescription>Valor médio após descontos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 450</div>
            <p className="text-sm text-muted-foreground">+3% em relação ao período anterior</p>
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
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Maria Silva</span>
              <span className="text-green-600 font-semibold">85%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">João Santos</span>
              <span className="text-green-600 font-semibold">78%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Ana Costa</span>
              <span className="text-green-600 font-semibold">72%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
