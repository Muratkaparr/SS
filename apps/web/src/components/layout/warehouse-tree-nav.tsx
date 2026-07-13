'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, FolderInput, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { cn } from '@/lib/cn';
import { clientFetch } from '@/lib/client-fetch';
import type { Warehouse } from '@/lib/types';
import { MoveWarehouseModal } from './move-warehouse-modal';

function hrefFor(basePath: string, ids: string[]) {
  return ids.length === 0 ? basePath : `${basePath}/warehouse/${ids.join('/')}`;
}

function WarehouseTreeNode({
  warehouse,
  ancestorIds,
  basePath,
  canManage,
  activePath,
}: {
  warehouse: Warehouse;
  ancestorIds: string[];
  basePath: string;
  canManage: boolean;
  activePath: string[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(warehouse.name);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const ids = [...ancestorIds, warehouse.id];
  const isActive = activePath.at(-1) === warehouse.id;
  // Alt depolar, ayrı bir aç/kapa tuşuyla değil, bu ana deponun içine girildiğinde
  // (yani URL'de yer aldığında) otomatik görünür — hangi ana depoya ait oldukları
  // her zaman doğrudan altında, girintili şekilde gösterildiği için de bellidir.
  const isOpen = activePath.includes(warehouse.id);

  const { data: children } = useQuery({
    queryKey: ['warehouses', warehouse.id],
    queryFn: () => clientFetch<Warehouse[]>(`/warehouses?parentId=${warehouse.id}`),
    enabled: isOpen && warehouse.childCount > 0,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      clientFetch(`/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => clientFetch(`/warehouses/${warehouse.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Depo silindi');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setDeleting(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleting(false);
    },
  });

  return (
    <div>
      {editing ? (
        <form
          className="flex items-center gap-1 py-1 pl-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (editValue.trim()) renameMutation.mutate(editValue.trim());
          }}
        >
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
            }}
            className="h-7 w-full rounded-sm border border-accent bg-surface px-2 text-xs text-ink outline-none"
          />
          <button
            type="submit"
            className="flex h-6 w-6 items-center justify-center rounded-sm text-success hover:bg-surface-hover"
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-surface-hover"
          >
            <X size={12} />
          </button>
        </form>
      ) : (
        <div
          className={cn(
            'group flex items-center gap-0.5 rounded-sm pr-1 text-sm transition-colors duration-150 ease-out-quart',
            isActive ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-surface-hover hover:text-ink',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'flex h-6 w-5 shrink-0 items-center justify-center text-muted',
              warehouse.childCount === 0 && 'invisible',
            )}
          >
            <ChevronRight
              size={12}
              className={cn('transition-transform duration-150', isOpen && 'rotate-90')}
            />
          </span>
          <Link href={hrefFor(basePath, ids)} className="flex-1 truncate py-1.5 pl-0.5">
            {warehouse.name}
          </Link>
          {canManage && (
            <span className="hidden items-center gap-0.5 group-hover:flex">
              <button
                type="button"
                onClick={() => {
                  setEditValue(warehouse.name);
                  setEditing(true);
                }}
                aria-label={`${warehouse.name} deposunu yeniden adlandır`}
                className="flex h-5 w-5 items-center justify-center rounded-sm hover:text-accent"
              >
                <Pencil size={10} />
              </button>
              <button
                type="button"
                onClick={() => setMoving(true)}
                aria-label={`${warehouse.name} deposunu başka bir üst depoya taşı`}
                title="Başka bir üst depoya taşı"
                className="flex h-5 w-5 items-center justify-center rounded-sm hover:text-accent"
              >
                <FolderInput size={10} />
              </button>
              <button
                type="button"
                onClick={() => setDeleting(true)}
                aria-label={`${warehouse.name} deposunu sil`}
                className="flex h-5 w-5 items-center justify-center rounded-sm hover:text-danger"
              >
                <Trash2 size={10} />
              </button>
            </span>
          )}
        </div>
      )}
      {isOpen && children && children.length > 0 && (
        <div className="ml-4 border-l border-border pl-1">
          {children.map((child) => (
            <WarehouseTreeNode
              key={child.id}
              warehouse={child}
              ancestorIds={ids}
              basePath={basePath}
              canManage={canManage}
              activePath={activePath}
            />
          ))}
        </div>
      )}
      {deleting && (
        <ConfirmModal
          open={deleting}
          onClose={() => setDeleting(false)}
          onConfirm={() => deleteMutation.mutate()}
          loading={deleteMutation.isPending}
          title="Depoyu sil"
          description={
            warehouse.totalDescendantWarehouseCount > 0
              ? `"${warehouse.name}" deposunu, altındaki ${warehouse.totalDescendantWarehouseCount} alt depoyu ve bu ağaçtaki toplam ${warehouse.totalProductCount} ürünü kalıcı olarak silmek istediğinize emin misiniz?`
              : `"${warehouse.name}" deposunu ve içindeki ${warehouse.totalProductCount} ürünü kalıcı olarak silmek istediğinize emin misiniz?`
          }
          confirmLabel="Sil"
          danger
        />
      )}
      {moving && (
        <MoveWarehouseModal warehouse={warehouse} open={moving} onClose={() => setMoving(false)} />
      )}
    </div>
  );
}

/** "Ürünler" nav öğesinin altında, admin'in/kullanıcının depo ağacını gösterir (sınırsız derinlik). */
export function WarehouseTreeNav({
  basePath,
  canManage,
}: {
  basePath: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: roots, isLoading } = useQuery({
    queryKey: ['warehouses', 'root'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses?parentId=root'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      clientFetch<Warehouse>('/warehouses', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      toast.success('Ana depo oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setCreating(false);
      setNewName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const marker = `${basePath}/warehouse/`;
  const activePath = pathname.startsWith(marker)
    ? pathname.slice(marker.length).split('/').filter(Boolean)
    : [];

  const isEmpty = isLoading || !roots || roots.length === 0;
  // Sidebar sessizce boş kalmamalı: Admin için zaten aşağıda "Yeni Ana Depo" kutusu
  // görünür, ama User (canManage=false) için hiçbir eylem yoksa bile kısa bir açıklama
  // gösterilir — aksi halde bu bölüm hiç var olmamış gibi görünür.
  if (isEmpty && !canManage) {
    if (isLoading) return null;
    return (
      <div className="ml-4 mt-0.5 border-l border-border pl-1">
        <p className="px-2 py-1.5 text-xs text-muted">Henüz size atanmış bir depo yok.</p>
      </div>
    );
  }

  return (
    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-1">
      {/* Ayrı, farklı bir Ana Depo eklemek için — alt depo eklemekle karışmaması için tree'nin
       * dışında, üstte ve belirgin (kesikli çerçeveli) bir kutu olarak gösterilir. */}
      {canManage &&
        (creating ? (
          <form
            className="mb-1 flex items-center gap-1 py-1 pl-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createMutation.mutate(newName.trim());
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreating(false);
                  setNewName('');
                }
              }}
              placeholder="Ana depo adı…"
              className="h-7 w-full rounded-sm border border-accent bg-surface px-2 text-xs text-ink outline-none"
            />
            <button
              type="submit"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-success hover:bg-surface-hover"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-surface-hover"
            >
              <X size={12} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            title="Diğerlerinden bağımsız, yeni ve ayrı bir Ana Depo oluşturur"
            className="mb-1 flex w-full items-center gap-1.5 rounded-sm border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted transition-colors duration-150 ease-out-quart hover:border-accent hover:bg-surface-hover hover:text-ink"
          >
            <Plus size={12} />
            Yeni Ana Depo
          </button>
        ))}
      {roots?.map((w) => (
        <WarehouseTreeNode
          key={w.id}
          warehouse={w}
          ancestorIds={[]}
          basePath={basePath}
          canManage={canManage}
          activePath={activePath}
        />
      ))}
    </div>
  );
}
