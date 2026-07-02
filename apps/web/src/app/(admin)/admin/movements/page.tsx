'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated, StockMovement } from '@/lib/types';

const MOVEMENT_LABEL: Record<string, string> = {
  IN: 'Giriş',
  OUT: 'Çıkış',
  ADJUSTMENT: 'Düzeltme',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminMovementsPage() {
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['movements', 'all', page],
    queryFn: () =>
      clientFetch<Paginated<StockMovement>>(`/stock/movements?page=${page}&limit=${limit}`),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Stok Hareketleri</h1>
        <p className="mt-1 text-sm text-muted">Tüm ürünlerdeki giriş, çıkış ve düzeltme kayıtları.</p>
      </div>

      <div className="rounded-md border border-border bg-surface">
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="Henüz stok hareketi yok" />
        ) : (
          <Table>
            <Thead>
              <Th>Tarih</Th>
              <Th>Ürün</Th>
              <Th>Tip</Th>
              <Th>Adet</Th>
              <Th>Açıklama</Th>
              <Th>Kullanıcı</Th>
            </Thead>
            <Tbody>
              {data.items.map((m) => (
                <Tr key={m.id}>
                  <Td className="text-muted">{formatDateTime(m.createdAt)}</Td>
                  <Td className="font-medium">{m.product.name}</Td>
                  <Td>
                    <Badge
                      tone={m.type === 'OUT' ? 'warning' : m.type === 'IN' ? 'success' : 'neutral'}
                      withIcon={false}
                    >
                      {MOVEMENT_LABEL[m.type]}
                    </Badge>
                  </Td>
                  <Td>
                    {m.quantity} {m.product.unit}
                  </Td>
                  <Td className="text-muted">{m.reason ?? '—'}</Td>
                  <Td className="text-muted">{m.user.name}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {data && data.total > limit && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Sayfa {page} / {totalPages} · {data.total} kayıt
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Önceki
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
