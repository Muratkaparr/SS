'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, PackageX, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated, Product, StockAlert, StockSummary } from '@/lib/types';

export function AdminDashboard() {
  const { data: summary } = useQuery({
    queryKey: ['stock-summary'],
    queryFn: () => clientFetch<StockSummary>('/stock/summary'),
  });

  const { data: alerts } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: () => clientFetch<StockAlert[]>('/stock/alerts'),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', '', '', false, 'out-of-stock'],
    queryFn: () => clientFetch<Paginated<Product>>('/products?limit=100'),
  });

  const outOfStock = (productsData?.items ?? []).filter((p) => p.currentStock <= 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Genel Bakış</h1>
        <p className="mt-1 text-sm text-muted">Stok durumu ve uyarılar.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Toplam Ürün" value={summary?.totalProducts ?? '—'} icon={Boxes} />
        <StatCard
          label="Kritik Seviyede"
          value={summary?.criticalCount ?? '—'}
          icon={AlertTriangle}
          tone={summary && summary.criticalCount > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Stoğu Tükenen"
          value={summary?.outOfStockCount ?? '—'}
          icon={PackageX}
          tone={summary && summary.outOfStockCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Kritik Stok Uyarıları</h2>
        </div>
        {!alerts || alerts.length === 0 ? (
          <EmptyState icon={TrendingDown} title="Kritik seviyede ürün yok" />
        ) : (
          <Table>
            <Thead>
              <Th>Ürün</Th>
              <Th>Depo</Th>
              <Th>Mevcut Stok</Th>
              <Th>Kritik Seviye</Th>
              <Th>Tükenmeye Kalan</Th>
              <Th>Durum</Th>
              <Th className="text-right">İşlem</Th>
            </Thead>
            <Tbody>
              {alerts.map((alert) => (
                <Tr key={alert.id}>
                  <Td className="font-medium">{alert.name}</Td>
                  <Td className="text-muted">{alert.warehouseName ?? '—'}</Td>
                  <Td>
                    {alert.currentStock} {alert.unit}
                  </Td>
                  <Td className="text-muted">
                    {alert.criticalLevel} {alert.unit}
                  </Td>
                  <Td className="text-muted">
                    {alert.daysUntilStockout != null ? `~${alert.daysUntilStockout} gün` : '—'}
                  </Td>
                  <Td>
                    <Badge tone={alert.severity === 'OUT_OF_STOCK' ? 'danger' : 'warning'}>
                      {alert.severity === 'OUT_OF_STOCK' ? 'Tükendi' : 'Kritik'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/admin/products/${alert.id}`}>
                      <Button size="sm" variant="secondary">
                        Ürüne git
                      </Button>
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <PackageX size={15} className="text-danger" />
          <h2 className="text-sm font-semibold text-ink">Stoğu Tükenen Ürünler</h2>
        </div>
        {outOfStock.length === 0 ? (
          <EmptyState icon={PackageX} title="Stoğu tükenen ürün yok" />
        ) : (
          <Table>
            <Thead>
              <Th>Ürün</Th>
              <Th>Depo</Th>
              <Th>Kritik Seviye</Th>
              <Th className="text-right">İşlem</Th>
            </Thead>
            <Tbody>
              {outOfStock.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="text-muted">{p.warehouse?.name ?? '—'}</Td>
                  <Td className="text-muted">
                    {p.criticalLevel} {p.unit}
                  </Td>
                  <Td className="text-right">
                    <Link href={`/admin/products/${p.id}`}>
                      <Button size="sm" variant="secondary">
                        Ürüne git
                      </Button>
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
