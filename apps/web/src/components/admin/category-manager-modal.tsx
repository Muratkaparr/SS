'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Category } from '@/lib/types';

export function CategoryManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleting, setDeleting] = useState<Category | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => clientFetch<Category[]>('/categories'),
    enabled: open,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  }

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      clientFetch<Category>('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      invalidate();
      setNewName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      clientFetch<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientFetch(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Kategori silindi');
      invalidate();
      setDeleting(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleting(null);
    },
  });

  return (
    <>
      <Modal open={open} onClose={onClose} title="Kategorileri Yönet" className="max-w-sm">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createMutation.mutate(newName.trim());
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yeni kategori adı…"
            className="flex-1"
          />
          <Button type="submit" size="sm" loading={createMutation.isPending}>
            <Plus size={14} />
            Ekle
          </Button>
        </form>

        <div className="mt-4 max-h-72 overflow-y-auto rounded-sm border border-border">
          {isLoading ? (
            <div className="h-24 animate-pulse bg-surface-2" />
          ) : !categories || categories.length === 0 ? (
            <EmptyState icon={Tag} title="Henüz kategori eklenmedi" />
          ) : (
            <div className="divide-y divide-border">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                  {editingId === c.id ? (
                    <form
                      className="flex flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editValue.trim()) renameMutation.mutate({ id: c.id, name: editValue.trim() });
                      }}
                    >
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-7 flex-1 rounded-sm border border-accent bg-surface px-2 text-sm text-ink outline-none"
                      />
                      <button
                        type="submit"
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-success hover:bg-surface-hover"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-surface-hover"
                      >
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 truncate text-sm text-ink">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditValue(c.name);
                        }}
                        aria-label={`${c.name} kategorisini yeniden adlandır`}
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-surface-hover hover:text-accent"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(c)}
                        aria-label={`${c.name} kategorisini sil`}
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-surface-hover hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </Modal>

      {deleting && (
        <ConfirmModal
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          loading={deleteMutation.isPending}
          title="Kategoriyi sil"
          description={`"${deleting.name}" kategorisini silmek istediğinize emin misiniz? Bu kategoriye atanmış ürünler silinmez, sadece kategorisiz kalır.`}
          confirmLabel="Sil"
          danger
        />
      )}
    </>
  );
}
