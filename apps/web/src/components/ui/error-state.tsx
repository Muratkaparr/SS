'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-danger/10 text-danger">
        <AlertTriangle size={22} />
      </div>
      <div>
        <p className="text-lg font-semibold text-ink">Bir şeyler ters gitti</p>
        <p className="mt-1 text-sm text-muted">
          {error.message || 'İstek tamamlanamadı, lütfen tekrar deneyin.'}
        </p>
      </div>
      <Button variant="secondary" onClick={reset}>
        <RotateCw size={15} />
        Tekrar dene
      </Button>
    </div>
  );
}
