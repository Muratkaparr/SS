'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CategoryManagerModal } from '@/components/admin/category-manager-modal';
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
  leadTimeDays: z.coerce.number().min(1, 'En az 1 gün olmalı'),
  safetyMarginDays: z.coerce.number().min(0),
  openingStock: z.coerce.number().min(0).optional(),
  /** Sadece düzenlemede kullanılır: depodaki ürün sayısını hızlıca değiştirmek için. */
  currentStock: z.coerce.number().min(0).optional(),
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
  const [managingCategories, setManagingCategories] = useState(false);

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
      leadTimeDays: 5,
      safetyMarginDays: 3,
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
              leadTimeDays: product.leadTimeDays,
              safetyMarginDays: product.safetyMarginDays,
              currentStock: product.currentStock,
            }
          : {
              name: '',
              description: '',
              unit: 'adet',
              categoryId: '',
              criticalLevel: 10,
              leadTimeDays: 5,
              safetyMarginDays: 3,
              openingStock: 0,
            },
      );
    }
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { currentStock, ...rest } = values;
      const payload = { ...rest, categoryId: rest.categoryId || undefined };

      if (isEdit) {
        const result = await clientFetch(`/products/${product!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...payload,
            applyToAllWarehouses: cascadeToAllWarehouses || undefined,
          }),
        });

        if (currentStock !== undefined && currentStock !== product!.currentStock) {
          try {
            await clientFetch('/stock/movements', {
              method: 'POST',
              body: JSON.stringify({
                productId: product!.id,
                type: 'ADJUSTMENT',
                quantity: currentStock,
                reason: 'Ürün formundan hızlı stok güncelleme (sayım)',
              }),
            });
          } catch (stockErr) {
            // Ürün alanları (isim/kategori/kritik seviye vb.) zaten kaydedildi — sadece stok
            // kısmı başarısız oldu. Bunu ayrı bir hata olarak bildir ki liste/detay stale
            // kalmasın ve kullanıcı neyin kaydolup neyin kaydolmadığını bilsin.
            throw new Error(
              `Ürün bilgileri kaydedildi, ancak stok güncellemesi başarısız oldu: ${(stockErr as Error).message}`,
            );
          }
        }

        return result;
      }

      return clientFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          warehouseId: needsWarehousePicker ? selectedWarehouseId : warehouseId,
        }),
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Ürün güncellendi' : 'Ürün eklendi');
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
    onSettled: () => {
      // Kısmi başarıda bile (ürün alanları kaydedildi, stok hareketi başarısız oldu) liste/detay
      // sunucudaki gerçek durumu yansıtmalı — bu yüzden başarı/hata fark etmeksizin invalidate edilir.
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
    },
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
    <>
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

        {isEdit && !cascadeToAllWarehouses && (
          <div>
            <Label htmlFor="currentStock">Mevcut Stok</Label>
            <Input id="currentStock" type="number" min={0} {...register('currentStock')} />
            <p className="mt-1 text-xs text-muted">
              Depodaki ürün sayısını buradan hızlıca değiştirebilirsiniz — bu bir stok hareketi
              ("Düzeltme") olarak Hareketler geçmişine kaydedilir. Neden/tarih detaylı bir kayıt
              için "Stok Hareketi" işlemini kullanın.
            </p>
          </div>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="categoryId">Kategori</Label>
            <button
              type="button"
              onClick={() => setManagingCategories(true)}
              className="text-xs font-medium text-accent hover:underline"
            >
              Kategorileri yönet
            </button>
          </div>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="leadTimeDays">Tedarik Süresi (gün)</Label>
            <Input id="leadTimeDays" type="number" min={1} {...register('leadTimeDays')} />
            <FieldError>{errors.leadTimeDays?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="safetyMarginDays">Güvenlik Payı (gün)</Label>
            <Input id="safetyMarginDays" type="number" min={0} {...register('safetyMarginDays')} />
            <FieldError>{errors.safetyMarginDays?.message}</FieldError>
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">
          Kritik seviye önerisi bu iki değere göre hesaplanır: tedarikçiden ürün gelene kadar geçen
          süre + ek güvenlik payı.
        </p>

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
    <CategoryManagerModal open={managingCategories} onClose={() => setManagingCategories(false)} />
    </>
  );
}
