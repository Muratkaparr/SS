'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/client-fetch';
import type { Order, Paginated } from '@/lib/types';
import { RejectOrderModal } from './reject-order-modal';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor',
  FULFILLED: 'Karşılandı',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal edildi',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  FULFILLED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * `canDecide`: onaylayan/reddeden taraf (admin) görünümü — talep eden sütunu + Karşıla/Reddet.
 * `canCancel`: talebi verenin kendi bekleyen siparişini iptal edebilmesi (kullanıcı paneli).
 */
export function OrdersList({
  canDecide = false,
  canCancel = false,
}: {
  canDecide?: boolean;
  canCancel?: boolean;
}) {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [fulfillTarget, setFulfillTarget] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'list'],
    queryFn: () => clientFetch<Paginated<Order>>('/orders?limit=100'),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['movements'] });
    queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
  }

  const fulfillMutation = useMutation({
    mutationFn: (id: string) =>
      clientFetch(`/orders/${id}/fulfill`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success('Sipariş karşılandı');
      invalidate();
      setFulfillTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => clientFetch(`/orders/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Sipariş iptal edildi');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = data?.items ?? [];
  const showActionsColumn = canDecide || canCancel;

  return (
    <div className="rounded-md border border-border bg-surface">
      {isLoading ? (
        <TableSkeleton rows={6} cols={canDecide ? 6 : 5} />
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Henüz sipariş yok" />
      ) : (
        <Table>
          <Thead>
            <Th>Tarih</Th>
            <Th>Ürün</Th>
            <Th>Adet</Th>
            {canDecide && <Th>Talep Eden</Th>}
            <Th>Not</Th>
            <Th>Durum</Th>
            {showActionsColumn && <Th className="text-right">İşlemler</Th>}
          </Thead>
          <Tbody>
            {items.map((order) => (
              <Tr key={order.id}>
                <Td className="text-muted">{formatDateTime(order.createdAt)}</Td>
                <Td className="font-medium">{order.product.name}</Td>
                <Td>
                  {order.quantity} {order.product.unit}
                </Td>
                {canDecide && <Td className="text-muted">{order.requestedBy.name}</Td>}
                <Td className="text-muted">{order.note ?? '—'}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[order.status]} withIcon={false}>
                    {STATUS_LABEL[order.status]}
                  </Badge>
                  {order.status !== 'PENDING' && order.decidedBy && (
                    <p className="mt-1 text-xs text-muted">{order.decidedBy.name}</p>
                  )}
                </Td>
                {showActionsColumn && (
                  <Td className="text-right">
                    {order.status !== 'PENDING' ? null : canDecide ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setFulfillTarget(order)}>
                          Karşıla
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejectTarget(order)}>
                          Reddet
                        </Button>
                      </div>
                    ) : canCancel ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(order.id)}
                      >
                        İptal Et
                      </Button>
                    ) : null}
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <ConfirmModal
        open={!!fulfillTarget}
        onClose={() => setFulfillTarget(null)}
        onConfirm={() => fulfillTarget && fulfillMutation.mutate(fulfillTarget.id)}
        loading={fulfillMutation.isPending}
        title="Siparişi Karşıla"
        description={
          fulfillTarget
            ? `${fulfillTarget.product.name} için ${fulfillTarget.quantity} ${fulfillTarget.product.unit} stoktan düşülecek. Devam edilsin mi?`
            : ''
        }
        confirmLabel="Karşıla"
      />

      <RejectOrderModal order={rejectTarget} onClose={() => setRejectTarget(null)} onSuccess={invalidate} />
    </div>
  );
}
