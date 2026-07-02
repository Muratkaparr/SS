'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Category, Product, Warehouse } from '@/lib/types';
import { ALL_WAREHOUSES_ID } from '@/lib/warehouse-constants';

const schema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  description: z.string().optional(),
  unit: z.string().min(1, 'Birim gerekli'),
  categoryId: z.string().optional(),
  criticalLevel: z.coerce.number().min(0),
  openingStock: z.coerce.number().min(0).optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function ProductFormModal({
  open,
  onClose,
  product,
  warehouseId,
  cascadeToAllWarehouses,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product;
  /** Yeni ürün oluştururken eklenecek depo (aktif sekme). Düzenlemede kullanılmaz. */
  warehouseId?: string;
  /** "Bütün Ürünler" sekmesinden düzenleniyorsa, değişiklik aynı isme sahip diğer depolardaki ürünlere de uygulanır. */
  cascadeToAllWarehouses?: boolean;
}) {
  const isEdit = !!product;
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const needsWarehousePicker = !isEdit && (!warehouseId || warehouseId === ALL_WAREHOUSES_ID);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => clientFetch<Category[]>('/categories'),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
    enabled: open && needsWarehousePicker,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      unit: 'adet',
      criticalLevel: 10,
    },
  });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- form/error state must resync when the modal reopens for a different product
      setServerError(null);
      setSelectedWarehouseId('');
      reset(
        product
          ? {
              name: product.name,
              description: product.description ?? '',
              unit: product.unit,
              categoryId: product.categoryId ?? '',
              criticalLevel: product.criticalLevel,
            }
          : {
              name: '',
              description: '',
              unit: 'adet',
              categoryId: '',
              criticalLevel: 10,
              openingStock: 0,
            },
      );
    }
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { ...values, categoryId: values.categoryId || undefined };
      return isEdit
        ? clientFetch(`/products/${product!.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              ...payload,
              applyToAllWarehouses: cascadeToAllWarehouses || undefined,
            }),
          })
        : clientFetch('/products', {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              warehouseId: needsWarehousePicker ? selectedWarehouseId : warehouseId,
            }),
          });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Ürün güncellendi' : 'Ürün eklendi');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    if (needsWarehousePicker && !selectedWarehouseId) {
      setServerError('Bir depo seçin');
      return;
    }
    mutation.mutate(values);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'} className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {isEdit && cascadeToAllWarehouses && (
          <p className="rounded-sm bg-accent/10 px-3 py-2 text-sm text-accent">
            Bu değişiklik, aynı isme sahip olduğu tüm depolardaki ürünlere uygulanacak.
          </p>
        )}

        {serverError && (
          <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
        )}

        {needsWarehousePicker && (
          <div>
            <Label htmlFor="product-warehouse">Depo</Label>
            <Select
              id="product-warehouse"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              <option value="">Depo seçin…</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="name">Ürün Adı</Label>
            <Input id="name" placeholder="Örn. Kablosuz Klavye" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="unit">Birim</Label>
            <Input id="unit" placeholder="adet" {...register('unit')} />
            <FieldError>{errors.unit?.message}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Açıklama (opsiyonel)</Label>
          <Textarea id="description" rows={2} {...register('description')} />
        </div>

        <div>
          <Label htmlFor="categoryId">Kategori</Label>
          <Select id="categoryId" {...register('categoryId')}>
            <option value="">Kategorisiz</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="criticalLevel">Kritik Seviye</Label>
          <Input id="criticalLevel" type="number" min={0} {...register('criticalLevel')} />
          <FieldError>{errors.criticalLevel?.message}</FieldError>
        </div>

        {!isEdit && (
          <div>
            <Label htmlFor="openingStock">Açılış Stoğu (opsiyonel)</Label>
            <Input id="openingStock" type="number" min={0} {...register('openingStock')} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? 'Kaydet' : 'Ürünü Ekle'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
