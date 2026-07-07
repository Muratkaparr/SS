import { Skeleton, TableSkeleton } from './skeleton';

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-md border border-border bg-surface">
        <TableSkeleton rows={6} cols={4} />
      </div>
    </div>
  );
}
