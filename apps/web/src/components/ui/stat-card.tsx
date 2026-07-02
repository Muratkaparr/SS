import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  neutral: 'text-ink',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon size={16} className="text-muted" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneClasses[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
