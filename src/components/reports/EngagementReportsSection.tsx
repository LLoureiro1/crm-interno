import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EngagementScoreBadge } from '@/components/EngagementScoreBadge';
import { ReportAccentInnerCard } from '@/components/reports/AdvancedReportLayout';
import {
  getScoreTier,
  getScoreTierLabel,
} from '@/utils/engagementScore';
import { getClassIdsForMultiSeriesFilter } from '@/utils/educationLevel';
import { STUDENT_STATUS_LABELS } from '@/utils/studentStatus';
import { cn } from '@/lib/utils';
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
  selectedUnitIds: string[];
  selectedSeriesIds: string[];
  selectedSegments: string[];
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
  selectedUnitIds,
  selectedSeriesIds,
  selectedSegments,
  currentAcademicYear,
}: EngagementReportsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [topLeadsByUnit, setTopLeadsByUnit] = useState<
    Array<{ unitId: string; unitName: string; leads: EngagementLead[] }>
  >([]);
  const [distribution, setDistribution] = useState<UnitEngagementDistribution[]>([]);

  const filterKey = useMemo(
    () =>
      [selectedUnitIds.join(','), selectedSeriesIds.join(','), selectedSegments.join(','), currentAcademicYear, visibleUnits.map((u) => u.id).join(',')].join('|'),
    [selectedUnitIds, selectedSeriesIds, selectedSegments, currentAcademicYear, visibleUnits]
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

        if (selectedUnitIds.length > 0) {
          query = query.in('unit_id', selectedUnitIds);
        }

        const classIds = getClassIdsForMultiSeriesFilter(
          classes,
          series,
          selectedSeriesIds,
          selectedSegments
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
  }, [filterKey, visibleUnits, classes, series, currentAcademicYear, selectedUnitIds, selectedSeriesIds, selectedSegments]);

  const hasData = useMemo(
    () => topLeadsByUnit.length > 0 || distribution.some((d) => d.alto + d.medio + d.baixo + d.sem > 0),
    [topLeadsByUnit, distribution]
  );

  return (
    <div className="space-y-4">
      <ReportAccentInnerCard
        icon={LineChart}
        title="Top leads por engajamento"
        description={`Até ${TOP_N_PER_UNIT} inscritos ativos com maior score por unidade`}
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !hasData || topLeadsByUnit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lead com score disponível.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[28%]" />
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs text-gray-500">Unidade</TableHead>
                  <TableHead className="text-xs text-gray-500">Aluno</TableHead>
                  <TableHead className="text-xs text-gray-500">Score</TableHead>
                  <TableHead className="text-xs text-gray-500">Status</TableHead>
                  <TableHead className="text-xs text-gray-500">Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLeadsByUnit.flatMap((unitBlock, unitIndex) =>
                  unitBlock.leads.map((lead, index) => (
                    <TableRow
                      key={lead.id}
                      className={cn(
                        'hover:bg-transparent',
                        index === 0 && unitIndex > 0 && 'border-t border-gray-200'
                      )}
                    >
                      <TableCell className="py-2 align-top text-sm font-medium text-gray-900">
                        {index === 0 ? unitBlock.unitName : ''}
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <Link
                          to={`/student/${lead.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {lead.student_name}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <EngagementScoreBadge score={lead.engagement_score} size="compact" />
                      </TableCell>
                      <TableCell className="py-2 align-top text-sm text-gray-500">
                        {STUDENT_STATUS_LABELS[lead.status] ?? lead.status}
                      </TableCell>
                      <TableCell className="py-2 align-top text-sm text-gray-500">
                        {lead.engagement_score_at
                          ? new Date(lead.engagement_score_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportAccentInnerCard>

      <ReportAccentInnerCard
        icon={LineChart}
        title="Distribuição de engajamento por unidade"
        description="Inscritos ativos em cada faixa de score"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : distribution.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs text-gray-500">Unidade</TableHead>
                  <TableHead className="text-center text-xs text-gray-500">{getScoreTierLabel('alto')}</TableHead>
                  <TableHead className="text-center text-xs text-gray-500">{getScoreTierLabel('medio')}</TableHead>
                  <TableHead className="text-center text-xs text-gray-500">{getScoreTierLabel('baixo')}</TableHead>
                  <TableHead className="text-center text-xs text-gray-500">{getScoreTierLabel('sem')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distribution.map((row) => (
                  <TableRow key={row.unitId} className="hover:bg-transparent">
                    <TableCell className="py-2 font-medium">{row.unitName}</TableCell>
                    <TableCell className="py-2 text-center">{row.alto}</TableCell>
                    <TableCell className="py-2 text-center">{row.medio}</TableCell>
                    <TableCell className="py-2 text-center">{row.baixo}</TableCell>
                    <TableCell className="py-2 text-center">{row.sem}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportAccentInnerCard>
    </div>
  );
}
