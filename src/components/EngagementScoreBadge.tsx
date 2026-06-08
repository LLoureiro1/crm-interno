import { cn } from '@/lib/utils';
import {
  formatScoreDisplay,
  getScoreBadgeClassName,
  getScoreTierLabel,
  getScoreTier,
} from '@/utils/engagementScore';

type EngagementScoreBadgeProps = {
  score: number | null | undefined;
  className?: string;
  showTier?: boolean;
  size?: 'default' | 'compact';
};

export function EngagementScoreBadge({
  score,
  className,
  showTier = false,
  size = 'default',
}: EngagementScoreBadgeProps) {
  const tier = getScoreTier(score);
  const isCompact = size === 'compact';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded border font-semibold tabular-nums',
        isCompact
          ? 'h-4 min-w-[1.375rem] px-0.5 text-[9px] leading-none rounded-sm'
          : 'rounded-md px-2 py-0.5 text-xs',
        getScoreBadgeClassName(score),
        className
      )}
      title={showTier ? undefined : getScoreTierLabel(tier)}
    >
      {formatScoreDisplay(score)}
      {showTier && tier !== 'sem' && !isCompact ? (
        <span className="ml-1 font-normal opacity-80">({getScoreTierLabel(tier)})</span>
      ) : null}
    </span>
  );
}
