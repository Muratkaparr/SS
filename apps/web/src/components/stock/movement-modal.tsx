'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Label, Select, Textarea } from '@/components/ui/input';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Product } from '@/lib/types';

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
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      clientFetch('/stock/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          type,
          quantity: Number(quantity),
          reason: reason || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success('Stok hareketi kaydedildi');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setQuantity('');
      setReason('');
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!quantity || Number(quantity) <= 0) {
      setError('Geçerli bir adet girin');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Stok Hareketi — ${product.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          Mevcut stok: <span className="font-medium text-ink">{product.currentStock} {product.unit}</span>
        </p>

        {error && (
          <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div>
          <Label htmlFor="movement-type">Hareket Tipi</Label>
          <Select
            id="movement-type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="IN">Giriş (stok ekle)</option>
            <option value="OUT">Çıkış (stok azalt)</option>
            <option value="ADJUSTMENT">Düzeltme (sayım)</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="movement-quantity">Adet</Label>
          <Input
            id="movement-quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />
          <FieldError />
        </div>

        <div>
          <Label htmlFor="movement-reason">Açıklama (opsiyonel)</Label>
          <Textarea
            id="movement-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Örn. haftalık sayım, tedarikçi teslimatı…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
