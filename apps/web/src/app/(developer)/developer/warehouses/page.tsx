'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Building2, MapPin, Plus, Users } from 'lucide-react';
import { WarehouseFormModal } from '@/components/developer/warehouse-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/client-fetch';
import type { Warehouse } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function DeveloperWarehousesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
  });

  const totals = warehouses?.reduce(
    (acc, w) => ({
      products: acc.products + w.productCount,
      critical: acc.critical + w.criticalCount,
      users: acc.users + w.userCount,
    }),
    { products: 0, critical: 0, users: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Depolar</h1>
          <p className="mt-1 text-sm text-muted">
            Sistemdeki tüm depoların toplu görünümü — her deponun içeriği ve ekibi farklıdır.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Yeni Depo
        </Button>
      </div>

      {warehouses && warehouses.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-sm text-muted">Toplam Depo</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{warehouses.length}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-sm text-muted">Toplam Ürün (tüm depolar)</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{totals?.products}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-sm text-muted">Kritik Stok (tüm depolar)</p>
            <p className={`mt-1 text-2xl font-semibold ${totals && totals.critical > 0 ? 'text-warning' : 'text-ink'}`}>
              {totals?.critical}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-md border border-border bg-surface">
          <TableSkeleton rows={4} cols={4} />
        </div>
      ) : !warehouses || warehouses.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            icon={Building2}
            title="Henüz depo yok"
            description='Önce bir Admin hesabı oluşturun, ardından "Yeni Depo" ile o Admin için depo açın.'
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <Link
              key={w.id}
              href={`/developer/warehouses/${w.id}`}
              className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 transition-colors duration-150 ease-out-quart hover:border-primary/40 hover:bg-surface-hover"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/15 text-primary">
                  <Building2 size={17} />
                </div>
                {w.criticalCount > 0 && (
                  <Badge tone="warning">{w.criticalCount} kritik</Badge>
                )}
              </div>
              <div>
                <p className="font-medium text-ink">{w.name}</p>
                {w.ownerName && (
                  <p className="mt-0.5 text-xs text-accent">Sahip: {w.ownerName}</p>
                )}
                {w.location && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <MapPin size={11} />
                    {w.location}
                  </p>
                )}
              </div>
              <div className="mt-1 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Boxes size={13} />
                  {w.productCount} ürün
                </span>
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  {w.userCount} kullanıcı
                </span>
                {w.criticalCount > 0 && (
                  <span className="flex items-center gap-1 text-warning">
                    <AlertTriangle size={13} />
                    {w.criticalCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted">Oluşturulma: {formatDate(w.createdAt)}</p>
            </Link>
          ))}
        </div>
      )}

      <WarehouseFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
