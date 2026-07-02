import { AlertTriangle, Boxes, PackageX, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { serverFetch } from '@/lib/server-fetch';
import type { StockAlert, StockSummary } from '@/lib/types';

export default async function UserDashboardPage() {
  const [summary, alerts] = await Promise.all([
    serverFetch<StockSummary>('/stock/summary'),
    serverFetch<StockAlert[]>('/stock/alerts'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Genel Bakış</h1>
        <p className="mt-1 text-sm text-muted">
          Depo stok durumunun salt okunur özeti — düzenleme yetkiniz bulunmuyor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Toplam Ürün" value={summary.totalProducts} icon={Boxes} />
        <StatCard
          label="Kritik Seviyede"
          value={summary.criticalCount}
          icon={AlertTriangle}
          tone={summary.criticalCount > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Stoğu Tükenen"
          value={summary.outOfStockCount}
          icon={PackageX}
          tone={summary.outOfStockCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Kritik Stok Uyarıları</h2>
        </div>
        {alerts.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="Kritik seviyede ürün yok"
            description="Tüm ürünler güvenli stok seviyesinin üzerinde."
          />
        ) : (
          <Table>
            <Thead>
              <Th>Ürün</Th>
              <Th>Kategori</Th>
              <Th>Mevcut Stok</Th>
              <Th>Kritik Seviye</Th>
              <Th>Tükenmeye Kalan</Th>
              <Th>Durum</Th>
            </Thead>
            <Tbody>
              {alerts.map((alert) => (
                <Tr key={alert.id}>
                  <Td className="font-medium">{alert.name}</Td>
                  <Td className="text-muted">{alert.category ?? '—'}</Td>
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
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
