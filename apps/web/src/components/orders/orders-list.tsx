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
  APPROVED: 'Onaylandı',
  FULFILLED: 'Tedarik edildi',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal edildi',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'accent'> = {
  PENDING: 'warning',
  APPROVED: 'accent',
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
 * `canDecide`: admin görünümü — bekleyen talepleri Onayla/Reddet (onaylanan sipariş tedarikçi kuyruğuna düşer).
 * `canSupply`: tedarikçi görünümü — onaylanmış siparişleri Tedarik Et (stok burada düşer, sipariş kapanır).
 * `canCancel`: talebi verenin kendi bekleyen/onaylanmış siparişini iptal edebilmesi (kullanıcı paneli).
 */
export function OrdersList({
  canDecide = false,
  canSupply = false,
  canCancel = false,
}: {
  canDecide?: boolean;
  canSupply?: boolean;
  canCancel?: boolean;
}) {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [supplyTarget, setSupplyTarget] = useState<Order | null>(null);

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

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      clientFetch(`/orders/${id}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success('Sipariş onaylandı, tedarikçiye düştü');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const supplyMutation = useMutation({
    mutationFn: (id: string) =>
      clientFetch(`/orders/${id}/supply`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success('Sipariş tedarik edildi');
      invalidate();
      setSupplyTarget(null);
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
  const showRequester = canDecide || canSupply;
  const showActionsColumn = canDecide || canSupply || canCancel;

  function decidedByLabel(order: Order) {
    if (order.status === 'FULFILLED') return order.suppliedBy?.name;
    if (order.status === 'APPROVED' || order.status === 'REJECTED' || order.status === 'CANCELLED') {
      return order.decidedBy?.name;
    }
    return undefined;
  }

  return (
    <div className="rounded-md border border-border bg-surface">
      {isLoading ? (
        <TableSkeleton rows={6} cols={showRequester ? 6 : 5} />
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Henüz sipariş yok" />
      ) : (
        <Table>
          <Thead>
            <Th>Tarih</Th>
            <Th>Ürün</Th>
            <Th>Adet</Th>
            {showRequester && <Th>Talep Eden</Th>}
            <Th>Not</Th>
            <Th>Durum</Th>
            {showActionsColumn && <Th className="text-right">İşlemler</Th>}
          </Thead>
          <Tbody>
            {items.map((order) => {
              const decidedBy = decidedByLabel(order);
              return (
                <Tr key={order.id}>
                  <Td className="text-muted">{formatDateTime(order.createdAt)}</Td>
                  <Td className="font-medium">{order.product.name}</Td>
                  <Td>
                    {order.quantity} {order.product.unit}
                  </Td>
                  {showRequester && <Td className="text-muted">{order.requestedBy.name}</Td>}
                  <Td className="text-muted">{order.note ?? '—'}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[order.status]} withIcon={false}>
                      {STATUS_LABEL[order.status]}
                    </Badge>
                    {decidedBy && <p className="mt-1 text-xs text-muted">{decidedBy}</p>}
                  </Td>
                  {showActionsColumn && (
                    <Td className="text-right">
                      {order.status === 'PENDING' && canDecide && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(order.id)}
                          >
                            Onayla
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setRejectTarget(order)}>
                            Reddet
                          </Button>
                        </div>
                      )}
                      {order.status === 'APPROVED' && canSupply && (
                        <Button size="sm" variant="secondary" onClick={() => setSupplyTarget(order)}>
                          Tedarik Et
                        </Button>
                      )}
                      {order.status === 'APPROVED' && canDecide && (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(order.id)}
                        >
                          Sil
                        </Button>
                      )}
                      {(order.status === 'PENDING' || order.status === 'APPROVED') &&
                        canCancel &&
                        !(order.status === 'PENDING' && canDecide) &&
                        !(order.status === 'APPROVED' && canSupply) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(order.id)}
                          >
                            İptal Et
                          </Button>
                        )}
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}

      <ConfirmModal
        open={!!supplyTarget}
        onClose={() => setSupplyTarget(null)}
        onConfirm={() => supplyTarget && supplyMutation.mutate(supplyTarget.id)}
        loading={supplyMutation.isPending}
        title="Siparişi Tedarik Et"
        description={
          supplyTarget
            ? `${supplyTarget.product.name} için ${supplyTarget.quantity} ${supplyTarget.product.unit} stoktan düşülecek ve sipariş kapanacak. Devam edilsin mi?`
            : ''
        }
        confirmLabel="Tedarik Et"
      />

      <RejectOrderModal order={rejectTarget} onClose={() => setRejectTarget(null)} onSuccess={invalidate} />
    </div>
  );
}
