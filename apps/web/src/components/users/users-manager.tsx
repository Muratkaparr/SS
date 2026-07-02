'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { PublicUser } from '@repo/shared-types';
import { UserFormModal } from '@/components/users/user-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/client-fetch';

const ROLE_LABEL: Record<string, string> = {
  USER: 'Kullanıcı',
  ADMIN: 'Admin',
  PLATFORM_ADMIN: 'Platform Admin',
};

const ROLE_TONE: Record<string, 'neutral' | 'accent' | 'success'> = {
  USER: 'neutral',
  ADMIN: 'accent',
  PLATFORM_ADMIN: 'success',
};

export function UsersManager({
  currentUserId,
  restrictToUserRole,
  title = 'Kullanıcılar',
  description = 'Hesap oluşturun, yetki değiştirin veya erişimi kaldırın.',
}: {
  currentUserId: string;
  /** Admin panelinden çağrıldığında true — sadece "Kullanıcı" rolündeki hesaplar listelenir/yönetilir (backend zaten bunu zorunlu kılar). */
  restrictToUserRole?: boolean;
  title?: string;
  description?: string;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [deleting, setDeleting] = useState<PublicUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', restrictToUserRole ?? 'all'],
    queryFn: () => clientFetch<PublicUser[]>('/users'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientFetch(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Kullanıcı silindi');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleting(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleting(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Yeni Kullanıcı
        </Button>
      </div>

      <div className="rounded-md border border-border bg-surface">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="Kullanıcı bulunamadı"
            description={restrictToUserRole ? 'Henüz bir kullanıcı hesabı oluşturulmadı.' : undefined}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Ad Soyad</Th>
              <Th>E-posta</Th>
              {!restrictToUserRole && <Th>Rol</Th>}
              {!restrictToUserRole && <Th>Bağlı Admin</Th>}
              <Th>Durum</Th>
              <Th className="text-right">İşlemler</Th>
            </Thead>
            <Tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <Tr key={u.id}>
                    <Td className="font-medium">
                      {u.name}
                      {isSelf && <span className="ml-2 text-xs text-muted">(siz)</span>}
                    </Td>
                    <Td className="text-muted">{u.email}</Td>
                    {!restrictToUserRole && (
                      <Td>
                        <Badge tone={ROLE_TONE[u.role]} withIcon={false}>
                          {ROLE_LABEL[u.role]}
                        </Badge>
                      </Td>
                    )}
                    {!restrictToUserRole && (
                      <Td className="text-muted">{u.adminOwnerName ?? '—'}</Td>
                    )}
                    <Td>
                      <Badge tone={u.isActive ? 'success' : 'danger'}>
                        {u.isActive ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isSelf}
                          title={isSelf ? 'Kendi hesabınızı silemezsiniz' : 'Sil'}
                          onClick={() => setDeleting(u)}
                          className="hover:!bg-danger/10 hover:!text-danger"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      <UserFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        restrictToUserRole={restrictToUserRole}
      />
      {editing && (
        <UserFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          user={editing}
          isSelf={editing.id === currentUserId}
          restrictToUserRole={restrictToUserRole}
        />
      )}
      {deleting && (
        <ConfirmModal
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          loading={deleteMutation.isPending}
          title="Kullanıcıyı sil"
          description={`"${deleting.name}" (${deleting.email}) hesabını kalıcı olarak silmek istediğinize emin misiniz?`}
          confirmLabel="Sil"
          danger
        />
      )}
    </div>
  );
}
