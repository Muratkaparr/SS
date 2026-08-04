'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated, Product } from '@/lib/types';

const schema = z.object({
  productId: z.string().min(1, 'Bir ürün seçin'),
  quantity: z.coerce.number().int().min(1, 'En az 1 olmalı'),
  note: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function OrderForm() {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ['products', 'picker'],
    queryFn: () => clientFetch<Paginated<Product>>('/products?limit=500'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { productId: '', quantity: 1, note: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      clientFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: values.productId,
          quantity: values.quantity,
          note: values.note || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success('Sipariş talebiniz alındı');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      reset({ productId: '', quantity: 1, note: '' });
    },
    onError: (err: Error) => setServerError(err.message),
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    mutation.mutate(values);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-md border border-border bg-surface p-5"
    >
      <div className="flex items-center gap-2">
        <ShoppingCart size={17} className="text-primary" />
        <h2 className="text-sm font-semibold text-ink">Sipariş Ver</h2>
      </div>

      {serverError && (
        <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="order-product">Ürün</Label>
          <Select id="order-product" {...register('productId')}>
            <option value="">Ürün seçin…</option>
            {(products?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — mevcut: {p.currentStock} {p.unit}
              </option>
            ))}
          </Select>
          <FieldError>{errors.productId?.message}</FieldError>
        </div>

        <div className="sm:w-32">
          <Label htmlFor="order-quantity">Adet</Label>
          <Input id="order-quantity" type="number" min={1} placeholder="1" {...register('quantity')} />
          <FieldError>{errors.quantity?.message}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="order-note">Not (opsiyonel)</Label>
        <Textarea id="order-note" rows={2} placeholder="Örn. ne için gerekli…" {...register('note')} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting || mutation.isPending}>
          Sipariş Ver
        </Button>
      </div>
    </form>
  );
}
