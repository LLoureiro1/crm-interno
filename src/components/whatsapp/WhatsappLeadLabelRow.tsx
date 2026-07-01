import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentPhoneLink, WhatsappConversationLabel } from '@/lib/whatsappConversations';

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

type WhatsappLeadLabelRowProps = {
  linkedStudent: StudentPhoneLink | null;
  label: WhatsappConversationLabel | undefined;
  saving: boolean;
  onSetPropensity: (stars: number) => void;
};

export function WhatsappLeadLabelRow({
  linkedStudent,
  label,
  saving,
  onSetPropensity,
}: WhatsappLeadLabelRowProps) {
  if (linkedStudent) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
        <span className="text-xs text-muted-foreground">Rótulo:</span>
        <Link
          to={`/student/${linkedStudent.id}`}
          className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800 hover:bg-green-100 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">Inscrito · {linkedStudent.student_name}</span>
        </Link>
      </div>
    );
  }

  const activeStars = label?.label_type === 'propensao' ? label.propensity_stars : null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-2 pb-2"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs text-muted-foreground">Propensão:</span>

      <div className="flex items-center gap-0.5">
        {STAR_VALUES.map((star) => {
          const filled = activeStars !== null && star <= activeStars;
          return (
            <button
              key={star}
              type="button"
              disabled={saving}
              title={`Propensão ${star} estrela${star > 1 ? 's' : ''}`}
              className={cn(
                'rounded p-0.5 transition-colors disabled:opacity-50',
                filled ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400',
              )}
              onClick={() => onSetPropensity(star)}
            >
              <Star className={cn('h-4 w-4', filled && 'fill-current')} />
            </button>
          );
        })}
      </div>

      {activeStars !== null && (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-900">
          {activeStars}/5
        </Badge>
      )}
    </div>
  );
}
