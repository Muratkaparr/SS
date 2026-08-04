import { cn } from '@/lib/cn';

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-tooltip mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-xs font-medium text-surface opacity-0 shadow-soft transition-opacity duration-150 ease-out-quart group-hover/tooltip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
