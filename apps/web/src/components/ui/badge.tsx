import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  accent: 'bg-accent/15 text-accent',
};

const toneIcon: Record<Tone, React.ReactNode> = {
  neutral: null,
  success: <CheckCircle2 size={12} />,
  warning: <AlertTriangle size={12} />,
  danger: <XCircle size={12} />,
  accent: <Info size={12} />,
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  withIcon = true,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  withIcon?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {withIcon && toneIcon[tone]}
      {children}
    </span>
  );
}
