import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const REPORT_INNER_CARD = 'relative overflow-hidden border-0 shadow-sm ring-1 ring-gray-100';

export function ReportSubsectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {children}
      </span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

export function MetricKpiCard({
  label,
  value,
  subtext,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  subtext?: string;
  compact?: boolean;
}) {
  return (
    <Card className={cn(REPORT_INNER_CARD, 'border-l-4 border-l-primary')}>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn('mt-1 text-2xl font-bold leading-tight text-primary')}>{value}</p>
        {!compact && subtext && <p className="mt-1 text-xs text-gray-400">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

export function ReportAccentInnerCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className={REPORT_INNER_CARD}>
      <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
      <CardHeader className="border-b border-gray-100 pb-3 pl-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="text-sm">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3">{children}</CardContent>
    </Card>
  );
}

export function ReportCountLink({
  count,
  label,
  onClick,
  tone = 'primary',
}: {
  count: number;
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'green';
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'text-xs hover:underline',
        tone === 'green' ? 'text-green-600' : 'text-primary'
      )}
    >
      {count} {label}
    </button>
  );
}

export function ProgressBarRow({
  label,
  value,
  valueLabel,
  percentage,
  links,
}: {
  label: ReactNode;
  value: ReactNode;
  valueLabel?: string;
  percentage: number;
  links?: ReactNode;
}) {
  return (
    <div className="space-y-1.5 border-b border-gray-100 py-2.5 last:border-0">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="text-gray-700">{label}</div>
          {links && <div className="mt-1 flex flex-wrap items-center gap-1.5">{links}</div>}
        </div>
        <div className="shrink-0 text-right">
          <span className="font-semibold text-primary">{value}</span>
          {valueLabel && <p className="text-[10px] text-gray-400">{valueLabel}</p>}
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

export function SummaryStatBox({
  label,
  value,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  tone?: 'blue' | 'green';
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-4',
        tone === 'green' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-primary'
      )}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}
