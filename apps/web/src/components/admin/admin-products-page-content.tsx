'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, CopyPlus, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { DuplicateProductModal } from '@/components/admin/duplicate-product-modal';
import { ProductFormModal } from '@/components/admin/product-form-modal';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { WarehouseTabs } from '@/components/products/warehouse-tabs';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Product, Warehouse } from '@/lib/types';
import { useWarehouseContext } from '@/lib/use-warehouse-context';
import { ALL_WAREHOUSES_ID } from '@/lib/warehouse-constants';

export function AdminProductsPageContent({ path }: { path: string[] }) {
  const queryClient = useQueryClient();
  const { currentParentId, breadcrumb, allLabel, renameAllLabel, preselectedWarehouseId } =
    useWarehouseContext(path);
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(null);
  const isAllWarehouses = activeWarehouseId === ALL_WAREHOUSES_ID;
  const [pageTitle, setPageTitle] = useState('Ürünler');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(pageTitle);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [duplicating, setDuplicating] = useState<Product | null>(null);

  // Bağlam (hangi Ana Depo'nun içindeyiz) değiştiğinde önceki seçili sekme artık geçersiz.
  // Sidebar'dan doğrudan bir yaprak depoya (alt deposu olmayan) girildiyse, sekme şeridi
  // onun üst deponun kardeşlerini gösterir ve bu depo orada önceden seçili gelir.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bağlam değişince sekme seçimi sıfırlanmalı/yaprak depoda o depo önceden seçili gelmeli
    setActiveWarehouseId(preselectedWarehouseId);
  }, [currentParentId, preselectedWarehouseId]);

  const { data: activeWarehouse } = useQuery({
    queryKey: ['warehouses', 'byId', activeWarehouseId],
    queryFn: () => clientFetch<Warehouse>(`/warehouses/${activeWarehouseId}`),
    enabled: !!activeWarehouseId && !isAllWarehouses,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientFetch(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Ürün silindi');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function saveTitle() {
    if (titleValue.trim()) {
      setPageTitle(titleValue.trim());
      setEditingTitle(false);
    }
  }

  return (
    <div className="space-y-6">
      {path.length > 0 && (
        <nav className="flex flex-wrap items-center justify-center gap-1 text-sm text-muted">
          <Link href="/admin/products" className="hover:text-ink hover:underline">
            Ürünler
          </Link>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight size={14} />
              {i === breadcrumb.length - 1 ? (
                <span className="font-medium text-ink">{b.name ?? '…'}</span>
              ) : (
                <Link
                  href={`/admin/products/warehouse/${path.slice(0, i + 1).join('/')}`}
                  className="hover:text-ink hover:underline"
                >
                  {b.name ?? '…'}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col items-center gap-3">
        {editingTitle ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveTitle();
            }}
          >
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setTitleValue(pageTitle);
                  setEditingTitle(false);
                }
              }}
              className="rounded-sm border border-accent bg-surface px-3 py-1 text-xl font-semibold text-ink outline-none"
            />
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-sm text-success hover:bg-surface-hover"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setTitleValue(pageTitle);
                setEditingTitle(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-surface-hover"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{pageTitle}</h1>
            <button
              onClick={() => {
                setTitleValue(pageTitle);
                setEditingTitle(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-hover hover:text-ink"
              title="Başlığı düzenle"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
        <p className="text-sm text-muted">
          &ldquo;{allLabel}&rdquo; bu bağlamdaki depolarınızı birleştirir; depolar arasında
          sekmelerle geçiş yapıp istediğiniz kadar depo ekleyip yeniden adlandırabilirsiniz.
        </p>
      </div>

      <WarehouseTabs
        activeId={activeWarehouseId}
        onChange={setActiveWarehouseId}
        canManage
        parentId={currentParentId}
        allLabel={allLabel}
        onRenameAllLabel={renameAllLabel}
      />

      {activeWarehouseId && !isAllWarehouses && (activeWarehouse?.childCount ?? 0) > 0 && (
        <Link
          href={`/admin/products/warehouse/${[...path, activeWarehouseId].join('/')}`}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <FolderOpen size={14} />
          &ldquo;{activeWarehouse!.name}&rdquo; içindeki {activeWarehouse!.childCount} alt depoyu görüntüle
        </Link>
      )}

      {activeWarehouseId && (
        <ProductsExplorer
          view="toggle"
          canAdjustStock
          canManagePhoto
          canReorder
          fixedWarehouseId={activeWarehouseId}
          parentAggregateId={currentParentId ?? undefined}
          onEdit={(product) => setEditing(product)}
          onDelete={(product) => setDeleting(product)}
          onDuplicate={(product) => setDuplicating(product)}
          headerAction={
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <Plus size={16} />
              Yeni Ürün
            </Button>
          }
          renderActions={(product) => (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="secondary" title="Düzenle" onClick={() => setEditing(product)}>
                <Pencil size={14} />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                title="Başka depoya ekle"
                onClick={() => setDuplicating(product)}
              >
                <CopyPlus size={14} />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                title="Sil"
                onClick={() => setDeleting(product)}
                className="hover:!bg-danger/10 hover:!text-danger"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        />
      )}

      {activeWarehouseId && (
        <ProductFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          warehouseId={activeWarehouseId}
        />
      )}
      {editing && (
        <ProductFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          product={editing}
          cascadeToAllWarehouses={isAllWarehouses}
        />
      )}
      {duplicating && (
        <DuplicateProductModal
          product={duplicating}
          open={!!duplicating}
          onClose={() => setDuplicating(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          loading={deleteMutation.isPending}
          title="Ürünü sil"
          description={`"${deleting.name}" ürününü ve stok geçmişini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          danger
        />
      )}
    </div>
  );
}
