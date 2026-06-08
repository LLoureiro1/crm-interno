import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EngagementScoreBadge } from '@/components/EngagementScoreBadge';
import {
  getScoreTier,
  getScoreTierLabel,
} from '@/utils/engagementScore';
import { getClassIdsForSeriesFilter } from '@/utils/educationLevel';
import type { Tables } from '@/integrations/supabase/types';

type EngagementLead = {
  id: string;
  student_name: string;
  status: string;
  unit_name: string;
  engagement_score: number;
  engagement_score_at: string | null;
};

type UnitEngagementDistribution = {
  unitId: string;
  unitName: string;
  alto: number;
  medio: number;
  baixo: number;
  sem: number;
};

type EngagementReportsSectionProps = {
  visibleUnits: Tables<'units'>[];
  classes: Tables<'classes'>[];
  series: Tables<'series'>[];
  selectedUnitId: string;
  selectedSeriesId: string;
  selectedSegment: string;
  currentAcademicYear: string;
};

const EXCLUDED_STATUSES = [
  'matriculado',
  'desistente',
  'cadastro_invalido',
  'processo_anos_anteriores',
] as const;

const TOP_N_PER_UNIT = 5;

export function EngagementReportsSection({
  visibleUnits,
  classes,
  series,
  selectedUnitId,
  selectedSeriesId,
  selectedSegment,
  currentAcademicYear,
}: EngagementReportsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [topLeadsByUnit, setTopLeadsByUnit] = useState<
    Array<{ unitId: string; unitName: string; leads: EngagementLead[] }>
  >([]);
  const [distribution, setDistribution] = useState<UnitEngagementDistribution[]>([]);

  const filterKey = useMemo(
    () =>
      [selectedUnitId, selectedSeriesId, selectedSegment, currentAcademicYear, visibleUnits.map((u) => u.id).join(',')].join('|'),
    [selectedUnitId, selectedSeriesId, selectedSegment, currentAcademicYear, visibleUnits]
  );

  useEffect(() => {
    const fetchEngagementReports = async () => {
      if (visibleUnits.length === 0) {
        setTopLeadsByUnit([]);
        setDistribution([]);
        return;
      }

      setLoading(true);
      try {
        let query = supabase
          .from('students')
          .select(`
            id,
            student_name,
            status,
            unit_id,
            engagement_score,
            engagement_score_at,
            classes (
              name,
              units ( name )
            )
          `)
          .eq('ano_letivo', parseInt(currentAcademicYear, 10))
          .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`);

        if (selectedUnitId !== 'all') {
          query = query.eq('unit_id', selectedUnitId);
        }

        const classIds = getClassIdsForSeriesFilter(
          classes,
          series,
          selectedSeriesId,
          selectedSegment
        );
        if (classIds !== null) {
          if (classIds.length > 0) {
            query = query.in('class_id', classIds);
          } else {
            query = query.eq('class_id', '00000000-0000-0000-0000-000000000000');
          }
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []) as Array<{
          id: string;
          student_name: string;
          status: string;
          unit_id: string;
          engagement_score: number | null;
          engagement_score_at: string | null;
          classes: { name: string; units: { name: string } | null } | null;
        }>;

        const visibleUnitIds = new Set(visibleUnits.map((u) => u.id));
        const filteredRows = rows.filter((row) => visibleUnitIds.has(row.unit_id));

        const distMap = new Map<string, UnitEngagementDistribution>();
        visibleUnits.forEach((unit) => {
          distMap.set(unit.id, {
            unitId: unit.id,
            unitName: unit.name,
            alto: 0,
            medio: 0,
            baixo: 0,
            sem: 0,
          });
        });

        const leadsByUnit = new Map<string, EngagementLead[]>();

        filteredRows.forEach((row) => {
          const tier = getScoreTier(row.engagement_score);
          const dist = distMap.get(row.unit_id);
          if (dist) {
            dist[tier === 'sem' ? 'sem' : tier]++;
          }

          if (row.engagement_score === null) return;

          const lead: EngagementLead = {
            id: row.id,
            student_name: row.student_name,
            status: row.status,
            unit_name: row.classes?.units?.name || '—',
            engagement_score: row.engagement_score,
            engagement_score_at: row.engagement_score_at,
          };

          const list = leadsByUnit.get(row.unit_id) || [];
          list.push(lead);
          leadsByUnit.set(row.unit_id, list);
        });

        const topByUnit = visibleUnits.map((unit) => ({
          unitId: unit.id,
          unitName: unit.name,
          leads: (leadsByUnit.get(unit.id) || [])
            .sort((a, b) => b.engagement_score - a.engagement_score)
            .slice(0, TOP_N_PER_UNIT),
        }));

        setTopLeadsByUnit(topByUnit.filter((u) => u.leads.length > 0));
        setDistribution(Array.from(distMap.values()));
      } catch (err) {
        console.error('Erro ao buscar relatórios de engajamento:', err);
        setTopLeadsByUnit([]);
        setDistribution([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEngagementReports();
  }, [filterKey, visibleUnits, classes, series, currentAcademicYear, selectedUnitId, selectedSeriesId, selectedSegment]);

  const hasData = useMemo(
    () => topLeadsByUnit.length > 0 || distribution.some((d) => d.alto + d.medio + d.baixo + d.sem > 0),
    [topLeadsByUnit, distribution]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Top leads por engajamento</CardTitle>
          <CardDescription>
            Até {TOP_N_PER_UNIT} inscritos ativos com maior score por unidade (exclui matriculados e desistentes)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !hasData || topLeadsByUnit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead com score disponível.</p>
          ) : (
            <div className="space-y-6">
              {topLeadsByUnit.map((unitBlock) => (
                <div key={unitBlock.unitId}>
                  <h4 className="mb-2 font-semibold text-gray-900">{unitBlock.unitName}</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aluno</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Atualizado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unitBlock.leads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <Link
                                to={`/student/${lead.id}`}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {lead.student_name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <EngagementScoreBadge score={lead.engagement_score} size="compact" />
                            </TableCell>
                            <TableCell className="text-sm">{lead.status}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lead.engagement_score_at
                                ? new Date(lead.engagement_score_at).toLocaleString('pt-BR')
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição de engajamento por unidade</CardTitle>
          <CardDescription>
            Quantidade de inscritos ativos em cada faixa de score
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : distribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-center">{getScoreTierLabel('alto')}</TableHead>
                    <TableHead className="text-center">{getScoreTierLabel('medio')}</TableHead>
                    <TableHead className="text-center">{getScoreTierLabel('baixo')}</TableHead>
                    <TableHead className="text-center">{getScoreTierLabel('sem')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distribution.map((row) => (
                    <TableRow key={row.unitId}>
                      <TableCell className="font-medium">{row.unitName}</TableCell>
                      <TableCell className="text-center">{row.alto}</TableCell>
                      <TableCell className="text-center">{row.medio}</TableCell>
                      <TableCell className="text-center">{row.baixo}</TableCell>
                      <TableCell className="text-center">{row.sem}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
