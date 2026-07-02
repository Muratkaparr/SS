'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CopyPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { DuplicateProductModal } from '@/components/admin/duplicate-product-modal';
import { ProductFormModal } from '@/components/admin/product-form-modal';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { WarehouseTabs } from '@/components/products/warehouse-tabs';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Product } from '@/lib/types';
import { ALL_WAREHOUSES_ID } from '@/lib/warehouse-constants';

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(null);
  const isAllWarehouses = activeWarehouseId === ALL_WAREHOUSES_ID;
  const [pageTitle, setPageTitle] = useState('Ürünler');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(pageTitle);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [duplicating, setDuplicating] = useState<Product | null>(null);

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
          &ldquo;Bütün Ürünler&rdquo; tüm depolarınızı birleştirir; depolar arasında sekmelerle
          geçiş yapıp istediğiniz kadar depo ekleyip yeniden adlandırabilirsiniz.
        </p>
      </div>

      <WarehouseTabs activeId={activeWarehouseId} onChange={setActiveWarehouseId} canManage />

      {activeWarehouseId && (
        <ProductsExplorer
          view="toggle"
          canAdjustStock
          canManagePhoto
          canReorder
          fixedWarehouseId={activeWarehouseId}
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
