'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Building2, Package, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated, Product, Warehouse } from '@/lib/types';

function stockTone(product: Product): 'danger' | 'warning' | 'success' {
  if (product.currentStock <= 0) return 'danger';
  if (product.currentStock <= product.criticalLevel) return 'warning';
  return 'success';
}

function stockLabel(product: Product): string {
  if (product.currentStock <= 0) return 'Tükendi';
  if (product.currentStock <= product.criticalLevel) return 'Kritik';
  return 'Normal';
}

export default function DeveloperProductsPage() {
  const [search, setSearch] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
  });

  // Bu sayfa "sistem geneli, eksiksiz" bir görünüm vaat ediyor — sayfalanmıyor, bu yüzden
  // sabit düşük bir limit yerine pratikte hiç dolmayacak yüksek bir üst sınır kullanılır.
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', 'developer-all'],
    queryFn: () => clientFetch<Paginated<Product>>('/products?limit=100000'),
  });

  /** Her deponun sahibi (Admin) adı — depo listesinden türetilir, ürün satırlarında gösterilir. */
  const ownerByWarehouseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses ?? []) {
      map.set(w.id, w.ownerName ?? '—');
    }
    return map;
  }, [warehouses]);

  const products = useMemo(() => {
    const items = data?.items ?? [];
    return items
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => !criticalOnly || p.currentStock <= p.criticalLevel);
  }, [data, search, criticalOnly]);

  const totalCritical = (data?.items ?? []).filter((p) => p.currentStock <= p.criticalLevel).length;
  const totalWarehouses = new Set((data?.items ?? []).map((p) => p.warehouseId)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Ürünler</h1>
        <p className="mt-1 text-sm text-muted">
          Sistemdeki tüm depolarda bulunan ürünlerin toplu, salt okunur görünümü.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Toplam Ürün" value={data?.total ?? 0} icon={Package} />
        <StatCard label="Ürün Bulunan Depo" value={totalWarehouses} icon={Building2} />
        <StatCard
          label="Kritik Stok"
          value={totalCritical}
          icon={AlertTriangle}
          tone={totalCritical > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı ile ara…"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-muted">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => setCriticalOnly(e.target.checked)}
            className="h-4 w-4 rounded-sm border-border accent-primary"
          />
          Sadece kritik
        </label>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-surface">
          <TableSkeleton rows={8} cols={6} />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState error={error as Error} reset={() => refetch()} />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            icon={Boxes}
            title="Ürün bulunamadı"
            description="Arama kriterlerinizi değiştirmeyi deneyin."
          />
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface">
          <Table>
            <Thead>
              <Th>Ürün</Th>
              <Th>Depo</Th>
              <Th>Sahip (Admin)</Th>
              <Th>Kategori</Th>
              <Th>Stok</Th>
              <Th>Durum</Th>
            </Thead>
            <Tbody>
              {products.map((product) => (
                <Tr key={product.id}>
                  <Td className="font-medium">{product.name}</Td>
                  <Td className="text-muted">{product.warehouse?.name ?? '—'}</Td>
                  <Td className="text-muted">
                    {ownerByWarehouseId.get(product.warehouseId) ?? '—'}
                  </Td>
                  <Td className="text-muted">{product.category?.name ?? '—'}</Td>
                  <Td>
                    {product.currentStock} {product.unit}
                  </Td>
                  <Td>
                    <Badge tone={stockTone(product)}>{stockLabel(product)}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
