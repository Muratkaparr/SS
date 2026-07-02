'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { clientFetch } from '@/lib/client-fetch';
import { cn } from '@/lib/cn';

export function StockStepper({
  productId,
  currentStock,
  unit,
  className,
}: {
  productId: string;
  currentStock: number;
  unit: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<'IN' | 'OUT' | null>(null);

  const mutation = useMutation({
    mutationFn: (type: 'IN' | 'OUT') => {
      setPending(type);
      return clientFetch('/stock/movements', {
        method: 'POST',
        body: JSON.stringify({ productId, type, quantity: 1 }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <button
        type="button"
        aria-label="Stoktan bir adet azalt"
        disabled={mutation.isPending || currentStock <= 0}
        onClick={() => mutation.mutate('OUT')}
        className="flex h-[37px] w-[37px] items-center justify-center rounded-sm border border-border text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === 'OUT' ? (
          <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-muted" />
        ) : (
          <Minus size={16} />
        )}
      </button>
      <div className="text-center">
        <p className="text-[21px] font-semibold leading-none text-ink">{currentStock}</p>
        <p className="text-[13px] leading-none text-muted">{unit}</p>
      </div>
      <button
        type="button"
        aria-label="Stoğa bir adet ekle"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate('IN')}
        className="flex h-[37px] w-[37px] items-center justify-center rounded-sm border border-border text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === 'IN' ? (
          <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-muted" />
        ) : (
          <Plus size={16} />
        )}
      </button>
    </div>
  );
}
