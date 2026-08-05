'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Check, GripVertical, Pencil, Plus, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { clientFetch } from '@/lib/client-fetch';
import { isProductCritical, mergeByName } from '@/lib/merge-products';
import type { Paginated, Product, Warehouse } from '@/lib/types';
import { ALL_WAREHOUSES_ID } from '@/lib/warehouse-constants';

const ALL_LABEL_EDIT_KEY = '__all__';
/** Bu dosyadaki ürün sorguları liste değil sayaç/rozet hesaplaması içindir — sayfalanmamalı. */
const AGGREGATE_FETCH_LIMIT = 100000;

export function WarehouseTabs({
  activeId,
  onChange,
  canManage,
  /** İçinde bulunulan bağlam: null ise kök (Ana Depo'lar), bir id ise o deponun direkt çocukları gösterilir. */
  parentId = null,
  /** Bu bağlamın "Bütün Ürünler" sanal sekmesi için gösterim adı. */
  allLabel = 'Bütün Ürünler',
  /** Sadece canManage iken çağrılır: "Bütün Ürünler" sekmesi yeniden adlandırıldığında. */
  onRenameAllLabel,
}: {
  activeId: string | null;
  onChange: (id: string) => void;
  /** Admin: sekmeleri oluşturabilir/yeniden adlandırabilir/silebilir. Kullanıcı: sadece geçiş yapar. */
  canManage?: boolean;
  parentId?: string | null;
  allLabel?: string;
  onRenameAllLabel?: (label: string) => void | Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const contextKey = parentId ?? 'root';

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses', contextKey],
    queryFn: () => clientFetch<Warehouse[]>(`/warehouses?parentId=${contextKey}`),
  });

  /** "Bütün Ürünler" rozeti kendi (birleştirilmiş) görünümüne göre hesaplanır — depoların
   * kendi kritik sayılarının toplamı değil. Bu bir sayaç hesaplaması olduğu için (görüntülenen
   * bir liste değil) limit sayfalanmaz — tüm ürünler alınmalı, aksi halde 100+ ürünlü bir
   * ağaçta rozet sessizce yanlış (düşük) sayı gösterir. */
  const { data: allProducts } = useQuery({
    queryKey: ['products', 'warehouse-tabs-critical', contextKey],
    queryFn: () =>
      clientFetch<Paginated<Product>>(
        `/products?limit=${AGGREGATE_FETCH_LIMIT}${parentId ? `&parentAggregateId=${parentId}` : '&rootAggregate=true'}`,
      ),
    enabled: (warehouses?.length ?? 0) > 0,
  });

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      clientFetch<Warehouse>('/warehouses', {
        method: 'POST',
        body: JSON.stringify(parentId ? { name, parentId } : { name }),
      }),
    onSuccess: (warehouse) => {
      toast.success('Depo oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onChange(warehouse.id);
      setCreating(false);
      setNewName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      clientFetch(`/warehouses/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      toast.success('Depo adı güncellendi');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameAllLabelMutation = useMutation({
    mutationFn: (label: string) => {
      if (!onRenameAllLabel) throw new Error('Bu görünüm yeniden adlandırılamaz');
      return Promise.resolve(onRenameAllLabel(label));
    },
    onSuccess: () => setEditingId(null),
    onError: (err: Error) => toast.error(err.message),
  });

  const includeToggleMutation = useMutation({
    mutationFn: ({ id, includeInParentTotal }: { id: string; includeInParentTotal: boolean }) =>
      clientFetch(`/warehouses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ includeInParentTotal }),
      }),
    onMutate: async ({ id, includeInParentTotal }) => {
      queryClient.setQueryData<Warehouse[]>(['warehouses', contextKey], (prev) =>
        prev?.map((w) => (w.id === id ? { ...w, includeInParentTotal } : w)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', contextKey] });
      queryClient.invalidateQueries({ queryKey: ['products', 'warehouse-tabs-critical', contextKey] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ['warehouses', contextKey] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientFetch(`/warehouses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Depo silindi');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      if (deleting && activeId === deleting.id) {
        onChange(ALL_WAREHOUSES_ID);
      }
      setDeleting(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleting(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) =>
      clientFetch('/warehouses/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),
    onError: (err: Error) => {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ['warehouses', contextKey] });
    },
  });

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId || !warehouses) {
      setDraggingId(null);
      return;
    }
    const reordered = [...warehouses];
    const fromIndex = reordered.findIndex((w) => w.id === draggingId);
    const toIndex = reordered.findIndex((w) => w.id === targetId);
    setDraggingId(null);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    queryClient.setQueryData<Warehouse[]>(['warehouses', contextKey], reordered);
    reorderMutation.mutate(reordered.map((w) => w.id));
  }

  if (isLoading) {
    return <div className="h-9 w-64 animate-pulse rounded-sm bg-surface-2" />;
  }

  if (warehouses && warehouses.length === 0 && !creating) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface">
        <EmptyState
          icon={Boxes}
          title={canManage ? 'Henüz depo eklenmedi' : 'Henüz size atanmış bir depo yok'}
          description={
            canManage
              ? 'Ürünleri takip etmeye başlamak için ilk deponuzu oluşturun.'
              : 'Bir yönetici size depo erişimi tanımladığında burada görünecek.'
          }
          action={
            canManage ? (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} />
                İlk Depoyu Ekle
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const mergedProducts = allProducts ? mergeByName(allProducts.items) : [];
  const totalProducts = mergedProducts.length;
  const totalCritical = mergedProducts.filter(isProductCritical).length;
  const isEditingAllLabel = editingId === ALL_LABEL_EDIT_KEY;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
      {warehouses && warehouses.length > 0 && !isEditingAllLabel && (
        <div className="group flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(ALL_WAREHOUSES_ID)}
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out-quart',
              activeId === ALL_WAREHOUSES_ID
                ? 'bg-primary/15 text-primary'
                : 'text-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            <Boxes size={14} />
            {allLabel}
            <Badge tone="neutral" withIcon={false} className="px-1.5 py-0">
              {totalProducts}
            </Badge>
            {totalCritical > 0 && (
              <Badge tone="warning" withIcon={false} className="px-1.5 py-0">
                {totalCritical}
              </Badge>
            )}
          </button>
          {canManage && onRenameAllLabel && (
            <button
              type="button"
              onClick={() => {
                setEditingId(ALL_LABEL_EDIT_KEY);
                setEditValue(allLabel);
              }}
              aria-label={`${allLabel} sekmesini yeniden adlandır`}
              className="flex h-5 w-5 items-center justify-center rounded-sm text-muted opacity-0 transition-opacity duration-150 hover:text-accent group-hover:opacity-100"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      )}

      {isEditingAllLabel && (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (editValue.trim()) renameAllLabelMutation.mutate(editValue.trim());
          }}
        >
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingId(null);
            }}
            className="h-8 w-40 rounded-sm border border-accent bg-surface px-2 text-sm text-ink outline-none"
          />
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-sm text-success hover:bg-surface-hover"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-surface-hover"
          >
            <X size={14} />
          </button>
        </form>
      )}

      {warehouses && warehouses.length > 0 && (
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
      )}

      {warehouses?.map((w) => {
        const isActive = w.id === activeId;
        const isEditing = editingId === w.id;

        if (isEditing) {
          return (
            <form
              key={w.id}
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (editValue.trim()) renameMutation.mutate({ id: w.id, name: editValue.trim() });
              }}
            >
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="h-8 w-36 rounded-sm border border-accent bg-surface px-2 text-sm text-ink outline-none"
              />
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-success hover:bg-surface-hover"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-surface-hover"
              >
                <X size={14} />
              </button>
            </form>
          );
        }

        return (
          <div
            key={w.id}
            draggable={canManage}
            onDragStart={() => setDraggingId(w.id)}
            onDragOver={(e) => {
              if (canManage) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(w.id);
            }}
            onDragEnd={() => setDraggingId(null)}
            className={cn(
              'group flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out-quart',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted hover:bg-surface-hover hover:text-ink',
              canManage && 'cursor-grab active:cursor-grabbing',
              draggingId === w.id && 'opacity-40',
            )}
          >
            {canManage && (
              <GripVertical
                size={12}
                className="shrink-0 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-60"
              />
            )}
            <button type="button" onClick={() => onChange(w.id)} className="flex items-center gap-1.5">
              {parentId === null && !w.includeInParentTotal && (
                <Star size={11} className="shrink-0 fill-current text-accent">
                  <title>Bağımsız depo — {allLabel}&apos;e dahil değil</title>
                </Star>
              )}
              {w.name}
              <Badge tone="neutral" withIcon={false} className="px-1.5 py-0">
                {w.productCount}
              </Badge>
              {w.criticalCount > 0 && (
                <Badge tone="warning" withIcon={false} className="px-1.5 py-0">
                  {w.criticalCount}
                </Badge>
              )}
            </button>
            {canManage && parentId !== null && (
              <label
                title="Ana Depoya Dahil Et/Çıkar"
                className="flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              >
                <input
                  type="checkbox"
                  checked={w.includeInParentTotal}
                  onChange={(e) =>
                    includeToggleMutation.mutate({ id: w.id, includeInParentTotal: e.target.checked })
                  }
                  className="h-3.5 w-3.5 rounded-sm border-border accent-primary"
                />
              </label>
            )}
            {canManage && (
              <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(w.id);
                    setEditValue(w.name);
                  }}
                  aria-label={`${w.name} deposunu yeniden adlandır`}
                  className="flex h-5 w-5 items-center justify-center rounded-sm hover:text-accent"
                >
                  <Pencil size={11} />
                </button>
                {(warehouses?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleting(w)}
                    aria-label={`${w.name} deposunu sil`}
                    className="flex h-5 w-5 items-center justify-center rounded-sm hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            )}
          </div>
        );
      })}

      {canManage &&
        (creating ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createMutation.mutate(newName.trim());
            }}
          >
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreating(false);
                  setNewName('');
                }
              }}
              placeholder="Depo adı…"
              className="h-8 w-36 rounded-sm border border-accent bg-surface px-2 text-sm text-ink outline-none"
            />
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-sm text-success hover:bg-surface-hover"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-surface-hover"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-sm font-medium text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-ink"
          >
            <Plus size={14} />
            Yeni Depo
          </button>
        ))}

      {deleting && (
        <ConfirmModal
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          loading={deleteMutation.isPending}
          title="Depoyu sil"
          description={
            deleting.totalDescendantWarehouseCount > 0
              ? `"${deleting.name}" deposunu, altındaki ${deleting.totalDescendantWarehouseCount} alt depoyu ve bu ağaçtaki toplam ${deleting.totalProductCount} ürünü kalıcı olarak silmek istediğinize emin misiniz?`
              : `"${deleting.name}" deposunu ve içindeki ${deleting.totalProductCount} ürünü kalıcı olarak silmek istediğinize emin misiniz?`
          }
          confirmLabel="Sil"
          danger
        />
      )}
    </div>
  );
}
