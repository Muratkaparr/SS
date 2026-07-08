'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, LayoutGrid, List, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/products/product-card';
import { ALL_WAREHOUSES_ID } from '@/lib/warehouse-constants';
import { cn } from '@/lib/cn';
import { clientFetch } from '@/lib/client-fetch';
import { mergeByName } from '@/lib/merge-products';
import type { Paginated, Product } from '@/lib/types';

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

type ViewMode = 'list' | 'grid';

export function ProductsExplorer({
  view = 'list',
  renderActions,
  headerAction,
  refreshKey,
  canAdjustStock,
  canManagePhoto,
  /** Admin: ürünleri sürükle-bırak ile yeniden sıralayabilir. */
  canReorder,
  onEdit,
  onDelete,
  onDuplicate,
  /** Platform Admin'in tek bir deponun içeriğine salt okunur bakması için (Depolar > Detay). */
  fixedWarehouseId,
  /** "Bütün Ürünler" seçiliyken, belirli bir ana deponun alt ağacıyla sınırlı toplamı istemek için. */
  parentAggregateId,
}: {
  /** 'toggle' kullanıcıya Liste/Kart arasında geçiş imkanı sunar. */
  view?: ViewMode | 'toggle';
  renderActions?: (product: Product) => React.ReactNode;
  headerAction?: React.ReactNode;
  refreshKey?: number;
  canAdjustStock?: boolean;
  canManagePhoto?: boolean;
  canReorder?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
  fixedWarehouseId?: string;
  parentAggregateId?: string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>(view === 'toggle' ? 'grid' : view);
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<Product[] | null>(null);

  const isAllWarehouses = fixedWarehouseId === ALL_WAREHOUSES_ID;
  const warehouseQueryParam = fixedWarehouseId && !isAllWarehouses ? fixedWarehouseId : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, criticalOnly, refreshKey, fixedWarehouseId, parentAggregateId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (criticalOnly) params.set('criticalOnly', 'true');
      if (warehouseQueryParam) {
        params.set('warehouseId', warehouseQueryParam);
      } else if (isAllWarehouses && parentAggregateId) {
        params.set('parentAggregateId', parentAggregateId);
      }
      params.set('limit', '100');
      return clientFetch<Paginated<Product>>(`/products?${params.toString()}`);
    },
  });

  const products = isAllWarehouses ? mergeByName(data?.items ?? []) : (data?.items ?? []);

  // Sunucudan yeni veri geldiğinde (veya filtre değiştiğinde) elle sıralamayı sunucu düzenine bırak.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistik sıralama, yeni veri gelince sıfırlanmalı
    setOrder(null);
  }, [data, isAllWarehouses, search, criticalOnly]);

  // Sıralama yalnızca filtresiz görünümde mümkün — filtreliyken kısmi listeyi yeniden dizmek
  // global sırayı bozardı.
  const reorderEnabled = !!canReorder && !search && !criticalOnly;
  const displayProducts = order ?? products;

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) =>
      clientFetch('/products/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setOrder(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  /** Görünen satırları, "Bütün Ürünler"de birleştirilmiş kardeş ürünleri de açarak id listesine çevirir. */
  function idsFor(list: Product[]): string[] {
    return list.flatMap((p) =>
      p.mergedWarehouses && p.mergedWarehouses.length > 0
        ? p.mergedWarehouses.map((w) => w.productId)
        : [p.id],
    );
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const list = [...displayProducts];
    const from = list.findIndex((p) => p.id === dragId);
    const to = list.findIndex((p) => p.id === targetId);
    setDragId(null);
    if (from === -1 || to === -1) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setOrder(list);
    reorderMutation.mutate(idsFor(list));
  }

  function dragProps(productId: string) {
    if (!reorderEnabled) return {};
    return {
      draggable: true,
      onDragStart: () => setDragId(productId),
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        handleDrop(productId);
      },
      onDragEnd: () => setDragId(null),
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
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
        <div className="flex items-center gap-2">
          {view === 'toggle' && (
            <div className="flex items-center rounded-sm border border-border p-0.5">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                aria-label="Liste görünümü"
                title="Liste görünümü"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-150 ease-out-quart',
                  activeView === 'list' ? 'bg-primary text-primary-ink' : 'text-muted hover:text-ink',
                )}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setActiveView('grid')}
                aria-label="Kart görünümü"
                title="Kart görünümü"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-150 ease-out-quart',
                  activeView === 'grid' ? 'bg-primary text-primary-ink' : 'text-muted hover:text-ink',
                )}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          )}
          {headerAction}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-surface">
          <TableSkeleton rows={6} cols={renderActions ? 6 : 5} />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            icon={Package}
            title="Ürün bulunamadı"
            description="Arama kriterlerinizi değiştirmeyi deneyin."
          />
        </div>
      ) : activeView === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {displayProducts.map((product) => (
            <div
              key={product.id}
              {...dragProps(product.id)}
              className={cn(
                'relative',
                reorderEnabled && 'cursor-grab active:cursor-grabbing',
                dragId === product.id && 'opacity-40',
              )}
            >
              {reorderEnabled && (
                <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-sm bg-surface/80 p-0.5 text-muted backdrop-blur-sm">
                  <GripVertical size={14} />
                </span>
              )}
              <ProductCard
                product={product}
                canAdjustStock={canAdjustStock && !isAllWarehouses}
                canManagePhoto={canManagePhoto}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                showWarehouseBadge={isAllWarehouses}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface">
          <Table>
            <Thead>
              {reorderEnabled && <Th className="w-8" />}
              <Th>Ürün</Th>
              {isAllWarehouses && <Th>Depo</Th>}
              <Th>Kategori</Th>
              <Th>Stok</Th>
              <Th>Kritik Seviye</Th>
              <Th>Durum</Th>
              {renderActions && <Th className="text-right">İşlemler</Th>}
            </Thead>
            <Tbody>
              {displayProducts.map((product) => (
                <Tr
                  key={product.id}
                  {...dragProps(product.id)}
                  className={cn(
                    reorderEnabled && 'cursor-grab active:cursor-grabbing',
                    dragId === product.id && 'opacity-40',
                  )}
                >
                  {reorderEnabled && (
                    <Td className="w-8 text-muted">
                      <GripVertical size={14} />
                    </Td>
                  )}
                  <Td>
                    <p className="font-medium">{product.name}</p>
                  </Td>
                  {isAllWarehouses && (
                    <Td className="text-muted">
                      {product.mergedWarehouses && product.mergedWarehouses.length > 1 ? (
                        <div>
                          <p className="text-ink">{product.warehouse?.name ?? '—'}</p>
                          <p
                            className="text-xs text-muted"
                            title={product.mergedWarehouses
                              .map((w) => `${w.name}: ${w.stock} ${product.unit}`)
                              .join('\n')}
                          >
                            + {product.mergedWarehouses.length - 1} depo daha
                          </p>
                        </div>
                      ) : (
                        (product.warehouse?.name ?? '—')
                      )}
                    </Td>
                  )}
                  <Td className="text-muted">{product.category?.name ?? '—'}</Td>
                  <Td>
                    {product.currentStock} {product.unit}
                  </Td>
                  <Td className="text-muted">
                    {product.criticalLevel} {product.unit}
                  </Td>
                  <Td>
                    <Badge tone={stockTone(product)}>{stockLabel(product)}</Badge>
                  </Td>
                  {renderActions && <Td className="text-right">{renderActions(product)}</Td>}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
