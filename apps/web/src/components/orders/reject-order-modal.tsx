'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Order } from '@/lib/types';

export function RejectOrderModal({
  order,
  onClose,
  onSuccess,
}: {
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (order) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal her açıldığında notu sıfırla
      setNote('');
    }
  }, [order]);

  const mutation = useMutation({
    mutationFn: () =>
      clientFetch(`/orders/${order!.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ note: note || undefined }),
      }),
    onSuccess: () => {
      toast.success('Sipariş reddedildi');
      onSuccess();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal open={!!order} onClose={onClose} title="Siparişi Reddet" className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {order && `${order.product.name} — ${order.quantity} ${order.product.unit}`}
        </p>
        <div>
          <Label htmlFor="reject-note">Gerekçe (opsiyonel)</Label>
          <Textarea
            id="reject-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Talep eden kişiye gösterilecek…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Reddet
          </Button>
        </div>
      </div>
    </Modal>
  );
}
