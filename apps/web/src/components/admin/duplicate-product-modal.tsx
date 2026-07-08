'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Product, Warehouse } from '@/lib/types';

const schema = z.object({
  targetWarehouseId: z.string().min(1, 'Bir depo seçin'),
  openingStock: z.coerce.number().min(0).optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function DuplicateProductModal({
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

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
    enabled: open,
  });

  const otherWarehouses = warehouses?.filter((w) => w.id !== product.warehouseId) ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { targetWarehouseId: '', openingStock: 0 },
  });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- form state must resync each time the modal reopens for a different product
      setServerError(null);
      reset({ targetWarehouseId: '', openingStock: 0 });
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      clientFetch(`/products/${product.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({
          targetWarehouseId: values.targetWarehouseId,
          openingStock: values.openingStock || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(`"${product.name}" seçilen depoya eklendi`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    mutation.mutate(values);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Başka Depoya Ekle — ${product.name}`} className="max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{product.name}</span> ürünü seçtiğiniz depoya
          eklenecek. Depoda aynı isimde bir ürün zaten varsa hata vermez — girdiğiniz miktar
          doğrudan o ürünün mevcut stoğuna eklenir.
        </p>

        {serverError && (
          <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
        )}

        {otherWarehouses.length === 0 ? (
          <p className="rounded-sm bg-surface-2 px-3 py-2 text-sm text-muted">
            Eklenebilecek başka bir deponuz yok. Önce &ldquo;Yeni Depo&rdquo; ile bir depo oluşturun.
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="dup-warehouse">Hedef Depo</Label>
              <Select id="dup-warehouse" {...register('targetWarehouseId')}>
                <option value="">Depo seçin…</option>
                {otherWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.targetWarehouseId?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="dup-opening">Miktar (opsiyonel)</Label>
              <Input id="dup-opening" type="number" min={0} placeholder="0" {...register('openingStock')} />
              <p className="mt-1 text-xs text-muted">
                Ürün hedef depoda yoksa açılış stoğu, varsa mevcut stoğa eklenecek miktar olarak
                kullanılır.
              </p>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            type="submit"
            loading={isSubmitting || mutation.isPending}
            disabled={otherWarehouses.length === 0}
          >
            Ekle
          </Button>
        </div>
      </form>
    </Modal>
  );
}
