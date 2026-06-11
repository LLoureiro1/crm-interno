import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { EngagementScoreBadge } from '@/components/EngagementScoreBadge';
import {
  ENGAGEMENT_WEIGHTS,
  formatScoreBreakdown,
  getRecencyWarning,
  type EngagementScoreBreakdown,
} from '@/utils/engagementScore';
import { Activity, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type EngagementScoreCardProps = {
  score: number | null | undefined;
  breakdown: EngagementScoreBreakdown | Record<string, unknown> | null | undefined;
  scoreAt?: string | null;
  scoreSource?: string | null;
  modelVersion?: string | null;
  className?: string;
};

export function EngagementScoreCard({
  score,
  breakdown,
  scoreAt,
  scoreSource,
  modelVersion,
  className,
}: EngagementScoreCardProps) {
  const items = formatScoreBreakdown(breakdown);
  const daysSinceTouch =
    breakdown && typeof breakdown === 'object'
      ? Number(
        'days_since_successful_contact' in breakdown
          ? breakdown.days_since_successful_contact
          : 'days_since_touch' in breakdown
            ? breakdown.days_since_touch
            : undefined
      )
      : undefined;
  const showColdWarning = getRecencyWarning(daysSinceTouch);

  if (score === null || score === undefined) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-base">
            <Activity className="h-4 w-4" />
            <span>Engajamento</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Score não aplicável a este inscrito (cadastro inválido ou processo de anos anteriores).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Engajamento</span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="max-w-xs text-sm">
                <p>
                  Score heurístico (0–100) com base em auto-agendamento, e-mails, comparecimento,
                  recência de contato, funil e contatos.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <EngagementScoreBadge score={score} showTier size="compact" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Intensidade</span>
            <span className="font-medium tabular-nums">{score}/100</span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        {showColdWarning && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Lead esfriando: {daysSinceTouch} dias sem contato bem-sucedido.
          </p>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Composição do score</p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{item.label}</span>
                  <span
                    className={
                      item.points > 0
                        ? 'font-medium text-green-700'
                        : item.key === 'days_since_touch'
                          ? 'font-medium text-gray-700'
                          : 'font-medium text-red-700'
                    }
                  >
                    {item.key === 'days_since_touch'
                      ? `${item.points} dias`
                      : `${item.points > 0 ? '+' : ''}${item.points}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          {scoreAt && (
            <p>Atualizado em {new Date(scoreAt).toLocaleString('pt-BR')}</p>
          )}
          <p>
            Fonte: {scoreSource === 'model' ? 'Modelo preditivo' : 'Heurística'} · faixas: alto ≥
            {ENGAGEMENT_WEIGHTS.tierHigh}, médio ≥{ENGAGEMENT_WEIGHTS.tierMedium}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
