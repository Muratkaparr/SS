'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, PlusCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ProductFormModal } from '@/components/admin/product-form-modal';
import { TrendChart } from '@/components/products/trend-chart';
import { MovementModal } from '@/components/stock/movement-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated, Product, StockMovement, TrendPoint } from '@/lib/types';

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

export function ProductDetail({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => clientFetch<Product>(`/products/${productId}`),
  });

  const { data: trend } = useQuery({
    queryKey: ['trend', productId],
    queryFn: () => clientFetch<TrendPoint[]>(`/stock/${productId}/trend?days=30`),
    enabled: !!product,
  });

  const { data: movements } = useQuery({
    queryKey: ['movements', productId],
    queryFn: () =>
      clientFetch<Paginated<StockMovement>>(`/stock/movements?productId=${productId}&limit=15`),
    enabled: !!product,
  });

  const applyMutation = useMutation({
    mutationFn: () => clientFetch(`/stock/${productId}/apply-suggestion`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Kritik seviye önerisi uygulandı');
      queryClient.invalidateQueries({ queryKey: ['products', productId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !product) {
    return <p className="text-sm text-muted">Yükleniyor…</p>;
  }

  const hasSuggestion =
    product.suggestedCriticalLevel != null &&
    product.suggestedCriticalLevel !== product.criticalLevel;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="flex h-8 w-8 items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-ink"
          >
            <ArrowLeft size={17} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-ink">{product.name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={14} />
            Düzenle
          </Button>
          <Button onClick={() => setMovementOpen(true)}>
            <PlusCircle size={14} />
            Stok Hareketi
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-muted">Mevcut Stok</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {product.currentStock} <span className="text-base font-normal text-muted">{product.unit}</span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone={product.currentStock <= product.criticalLevel ? 'warning' : 'success'}>
              Kritik seviye: {product.criticalLevel} {product.unit}
            </Badge>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-muted">Günlük Ortalama Tüketim</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{product.avgDailyConsumption7d}</p>
          <p className="mt-1 text-xs text-muted">Son 7 gün · 30 gün: {product.avgDailyConsumption30d}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Sistem Önerisi</p>
            <Badge tone={product.confidence === 'HIGH' ? 'success' : 'neutral'} withIcon={false}>
              {product.confidence}
            </Badge>
          </div>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {product.suggestedCriticalLevel ?? '—'}{' '}
            <span className="text-base font-normal text-muted">{product.unit}</span>
          </p>
          {hasSuggestion && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              loading={applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
            >
              <Sparkles size={13} />
              Öneriyi uygula
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Günlük Stok Hareketi (30 gün)</h2>
        {trend && <TrendChart data={trend} />}
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Son Stok Hareketleri</h2>
        </div>
        <Table>
          <Thead>
            <Th>Tarih</Th>
            <Th>Tip</Th>
            <Th>Adet</Th>
            <Th>Açıklama</Th>
            <Th>Kullanıcı</Th>
          </Thead>
          <Tbody>
            {movements?.items.map((m) => (
              <Tr key={m.id}>
                <Td className="text-muted">{formatDateTime(m.createdAt)}</Td>
                <Td>
                  <Badge
                    tone={m.type === 'OUT' ? 'warning' : m.type === 'IN' ? 'success' : 'neutral'}
                    withIcon={false}
                  >
                    {MOVEMENT_LABEL[m.type]}
                  </Badge>
                </Td>
                <Td>{m.quantity} {product.unit}</Td>
                <Td className="text-muted">{m.reason ?? '—'}</Td>
                <Td className="text-muted">{m.user.name}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      <ProductFormModal open={editOpen} onClose={() => setEditOpen(false)} product={product} />
      <MovementModal open={movementOpen} onClose={() => setMovementOpen(false)} product={product} />
    </div>
  );
}
