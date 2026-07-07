'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  Building2,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { WarehouseFormModal } from '@/components/developer/warehouse-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { clientFetch } from '@/lib/client-fetch';
import type { Warehouse } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface OwnerGroup {
  ownerId: string;
  ownerName: string;
  warehouses: Warehouse[];
  productCount: number;
  criticalCount: number;
  /** Admin'in ekip büyüklüğü — her deposunda aynı değer tekrarlanır, o yüzden toplanmaz. */
  userCount: number;
}

export default function DeveloperWarehousesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientFetch(`/warehouses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Depo silindi');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setDeleting(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleting(null);
    },
  });

  const totals = warehouses?.reduce(
    (acc, w) => ({
      products: acc.products + w.productCount,
      critical: acc.critical + w.criticalCount,
      users: acc.users + w.userCount,
    }),
    { products: 0, critical: 0, users: 0 },
  );

  /** Depoları sahibi olan Admin'e göre grupla — her Admin kendi sekmesinde. */
  const groups = useMemo<OwnerGroup[]>(() => {
    if (!warehouses) return [];
    const byOwner = new Map<string, OwnerGroup>();
    for (const w of warehouses) {
      let group = byOwner.get(w.ownerId);
      if (!group) {
        group = {
          ownerId: w.ownerId,
          ownerName: w.ownerName ?? 'Bilinmeyen Admin',
          warehouses: [],
          productCount: 0,
          criticalCount: 0,
          userCount: w.userCount,
        };
        byOwner.set(w.ownerId, group);
      }
      group.warehouses.push(w);
      group.productCount += w.productCount;
      group.criticalCount += w.criticalCount;
    }
    return Array.from(byOwner.values()).sort((a, b) =>
      a.ownerName.localeCompare(b.ownerName, 'tr'),
    );
  }, [warehouses]);

  function toggle(ownerId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ownerId)) {
        next.delete(ownerId);
      } else {
        next.add(ownerId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Depolar</h1>
          <p className="mt-1 text-sm text-muted">
            Depolar, sahibi olan Admin'e göre gruplanır — bir Admin'in depolarını görmek için üzerine tıklayın.
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
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = expanded.has(g.ownerId);
            return (
              <div key={g.ownerId} className="rounded-md border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => toggle(g.ownerId)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out-quart hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      size={16}
                      className={cn(
                        'shrink-0 text-muted transition-transform duration-150 ease-out-quart',
                        isOpen && 'rotate-90',
                      )}
                    />
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent/15 text-accent">
                      <UserRound size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">{g.ownerName}</p>
                        <Badge tone="accent" withIcon={false}>
                          {g.productCount} ürün
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {g.warehouses.length} depo · {g.userCount} kullanıcı
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.criticalCount > 0 && <Badge tone="warning">{g.criticalCount} kritik</Badge>}
                  </div>
                </button>

                {isOpen && (
                  <div className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Sanal "toplam" kartı — gerçek bir depo değil, bu Admin'in tüm depolarının birleşik görünümüne götürür. */}
                    <Link
                      href={`/developer/warehouses/${g.ownerId}?owner=all`}
                      className="flex flex-col gap-3 rounded-md border border-accent/30 bg-accent/5 p-4 transition-colors duration-150 ease-out-quart hover:border-accent/60 hover:bg-accent/10"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent/15 text-accent">
                          <Boxes size={17} />
                        </div>
                        {g.criticalCount > 0 && <Badge tone="warning">{g.criticalCount} kritik</Badge>}
                      </div>
                      <div>
                        <p className="font-medium text-ink">Bütün Depolar</p>
                        <p className="mt-0.5 text-xs text-muted">{g.warehouses.length} depo dahil</p>
                      </div>
                      <div className="mt-1 flex items-center gap-4 border-t border-accent/20 pt-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Boxes size={13} />
                          {g.productCount} ürün
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={13} />
                          {g.userCount} kullanıcı
                        </span>
                        {g.criticalCount > 0 && (
                          <span className="flex items-center gap-1 text-warning">
                            <AlertTriangle size={13} />
                            {g.criticalCount}
                          </span>
                        )}
                      </div>
                    </Link>
                    {g.warehouses.map((w) => (
                      <div key={w.id} className="group relative">
                        <Link
                          href={`/developer/warehouses/${w.id}`}
                          className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-4 transition-colors duration-150 ease-out-quart hover:border-primary/40 hover:bg-surface-hover"
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
                            <p className="pr-16 font-medium text-ink">{w.name}</p>
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
                        <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-150 ease-out-quart group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setEditing(w);
                            }}
                            title="Depoyu düzenle"
                            className="flex h-7 w-7 items-center justify-center rounded-sm bg-surface text-muted shadow-sm transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-ink"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setDeleting(w);
                            }}
                            title="Depoyu sil"
                            className="flex h-7 w-7 items-center justify-center rounded-sm bg-surface text-muted shadow-sm transition-colors duration-150 ease-out-quart hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <WarehouseFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && (
        <WarehouseFormModal open={!!editing} onClose={() => setEditing(null)} warehouse={editing} />
      )}
      {deleting && (
        <ConfirmModal
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          loading={deleteMutation.isPending}
          title="Depoyu sil"
          description={`"${deleting.name}" deposunu ve içindeki ${deleting.productCount} ürünü kalıcı olarak silmek istediğinize emin misiniz?`}
          confirmLabel="Sil"
          danger
        />
      )}
    </div>
  );
}
