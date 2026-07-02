'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Boxes, Users } from 'lucide-react';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { StatCard } from '@/components/ui/stat-card';
import { clientFetch } from '@/lib/client-fetch';
import type { Warehouse } from '@/lib/types';

export default function DeveloperWarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: warehouse } = useQuery({
    queryKey: ['warehouses', id],
    queryFn: () => clientFetch<Warehouse>(`/warehouses/${id}`),
  });

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
