'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Product } from '@/lib/types';

const schema = z
  .object({
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
    quantity: z.coerce.number().min(0, 'Değer 0 veya üzeri olmalı'),
    reason: z.string().optional(),
  })
  .refine((v) => v.type === 'ADJUSTMENT' || v.quantity >= 1, {
    message: 'Geçerli bir adet girin',
    path: ['quantity'],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function MovementModal({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'IN', quantity: 0, reason: '' },
  });

  const isAdjustment = watch('type') === 'ADJUSTMENT';

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal her açıldığında formu sıfırla
      setServerError(null);
      reset({ type: 'IN', quantity: 0, reason: '' });
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      clientFetch('/stock/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          type: values.type,
          quantity: values.quantity,
          reason: values.reason || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success('Stok hareketi kaydedildi');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    mutation.mutate(values);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Stok Hareketi — ${product.name}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted">
          Mevcut stok: <span className="font-medium text-ink">{product.currentStock} {product.unit}</span>
        </p>

        {serverError && (
          <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
        )}

        <div>
          <Label htmlFor="movement-type">Hareket Tipi</Label>
          <Select id="movement-type" {...register('type')}>
            <option value="IN">Giriş (stok ekle)</option>
            <option value="OUT">Çıkış (stok azalt)</option>
            <option value="ADJUSTMENT">Düzeltme (sayım)</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="movement-quantity">
            {isAdjustment ? 'Yeni Toplam Stok (sayım)' : 'Adet'}
          </Label>
          <Input
            id="movement-quantity"
            type="number"
            min={isAdjustment ? 0 : 1}
            placeholder="0"
            {...register('quantity')}
          />
          {isAdjustment ? (
            <p className="mt-1 text-xs text-muted">
              Girdiğiniz sayı eklenen/çıkarılan miktar değil, sayım sonrası ürünün yeni toplam
              stoğudur.
            </p>
          ) : (
            <FieldError>{errors.quantity?.message}</FieldError>
          )}
        </div>

        <div>
          <Label htmlFor="movement-reason">Açıklama (opsiyonel)</Label>
          <Textarea
            id="movement-reason"
            rows={2}
            placeholder="Örn. haftalık sayım, tedarikçi teslimatı…"
            {...register('reason')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
