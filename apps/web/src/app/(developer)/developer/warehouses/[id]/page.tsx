'use client';

import Link from 'next/link';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Boxes, Users } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StatCard } from '@/components/ui/stat-card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/client-fetch';
import { isProductCritical, mergeByName } from '@/lib/merge-products';
import type { Paginated, Product, Warehouse } from '@/lib/types';

export default function DeveloperWarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();

  if (searchParams.get('owner') === 'all') {
    return <OwnerWarehousesView ownerId={id} />;
  }

  return <SingleWarehouseView id={id} />;
}

function SingleWarehouseView({ id }: { id: string }) {
  const {
    data: warehouse,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['warehouses', id],
    queryFn: () => clientFetch<Warehouse>(`/warehouses/${id}`),
  });

  if (isError) {
    return <ErrorState error={error as Error} reset={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/developer/warehouses"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-ink"
        >
          <ArrowLeft size={17} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-ink">{warehouse?.name ?? 'Depo'}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {warehouse?.location ?? 'Depo içeriği — salt okunur görünüm'}
          </p>
        </div>
      </div>

      {warehouse && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Ürün Sayısı" value={warehouse.productCount} icon={Boxes} />
          <StatCard
            label="Kritik Stok"
            value={warehouse.criticalCount}
            icon={AlertTriangle}
            tone={warehouse.criticalCount > 0 ? 'warning' : 'neutral'}
          />
          <StatCard label="Aktif Kullanıcı" value={warehouse.userCount} icon={Users} />
        </div>
      )}

      <ProductsExplorer view="grid" fixedWarehouseId={id} />
    </div>
  );
}

/** "Bütün Depolar" sanal kartı — bir Admin'in tüm depolarındaki ürünleri isme göre birleştirip gösterir. */
function OwnerWarehousesView({ ownerId }: { ownerId: string }) {
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
  });
  const ownerWarehouses = (warehouses ?? []).filter((w) => w.ownerId === ownerId);
  const ownerName = ownerWarehouses[0]?.ownerName ?? 'Admin';

  // Bu görünüm bir sayaç değil, tam bir birleşik ürün ızgarasıdır — sayfalanmıyor,
  // bu yüzden kesilmemesi için yüksek bir üst sınır kullanılır.
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', 'developer-all'],
    queryFn: () => clientFetch<Paginated<Product>>('/products?limit=100000'),
  });

  const warehouseIds = new Set(ownerWarehouses.map((w) => w.id));
  const scopedProducts = (data?.items ?? []).filter((p) => warehouseIds.has(p.warehouseId));
  const merged = mergeByName(scopedProducts);
  const totalCritical = merged.filter(isProductCritical).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/developer/warehouses"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-ink"
        >
          <ArrowLeft size={17} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-ink">Bütün Depolar — {ownerName}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {ownerWarehouses.length} deponun birleşik görünümü — salt okunur
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ürün Sayısı" value={merged.length} icon={Boxes} />
        <StatCard
          label="Kritik Stok"
          value={totalCritical}
          icon={AlertTriangle}
          tone={totalCritical > 0 ? 'warning' : 'neutral'}
        />
        <StatCard label="Aktif Kullanıcı" value={ownerWarehouses[0]?.userCount ?? 0} icon={Users} />
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-surface">
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState error={error as Error} reset={() => refetch()} />
        </div>
      ) : merged.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState icon={Boxes} title="Bu Admin'in henüz ürünü yok" />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {merged.map((product) => (
            <ProductCard key={product.id} product={product} showWarehouseBadge />
          ))}
        </div>
      )}
    </div>
  );
}
