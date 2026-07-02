'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Product, Warehouse } from '@/lib/types';

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
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [openingStock, setOpeningStock] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
    enabled: open,
  });

  const otherWarehouses = warehouses?.filter((w) => w.id !== product.warehouseId) ?? [];

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- form state must resync each time the modal reopens for a different product
      setTargetWarehouseId('');
      setOpeningStock('');
      setError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      clientFetch(`/products/${product.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({
          targetWarehouseId,
          openingStock: openingStock ? Number(openingStock) : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(`"${product.name}" seçilen depoya eklendi`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!targetWarehouseId) {
      setError('Bir depo seçin');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Başka Depoya Ekle — ${product.name}`} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{product.name}</span> ürünü, seçtiğiniz depoya aynı
          bilgilerle (stok sıfırdan) eklenecek.
        </p>

        {error && (
          <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {otherWarehouses.length === 0 ? (
          <p className="rounded-sm bg-surface-2 px-3 py-2 text-sm text-muted">
            Eklenebilecek başka bir deponuz yok. Önce &ldquo;Yeni Depo&rdquo; ile bir depo oluşturun.
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="dup-warehouse">Hedef Depo</Label>
              <Select
                id="dup-warehouse"
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
              >
                <option value="">Depo seçin…</option>
                {otherWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="dup-opening">Açılış Stoğu (opsiyonel)</Label>
              <Input
                id="dup-opening"
                type="number"
                min={0}
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={otherWarehouses.length === 0}>
            Ekle
          </Button>
        </div>
      </form>
    </Modal>
  );
}
