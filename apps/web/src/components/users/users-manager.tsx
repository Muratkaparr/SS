'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { PublicUser } from '@repo/shared-types';
import { UserFormModal } from '@/components/users/user-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated, Warehouse } from '@/lib/types';

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

function UserActions({
  user,
  currentUserId,
  onEdit,
  onDelete,
}: {
  user: PublicUser;
  currentUserId: string;
  onEdit: (u: PublicUser) => void;
  onDelete: (u: PublicUser) => void;
}) {
  const isSelf = user.id === currentUserId;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Aktif' : 'Pasif'}</Badge>
      <Button size="sm" variant="secondary" onClick={() => onEdit(user)}>
        <Pencil size={14} />
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={isSelf}
        title={isSelf ? 'Kendi hesabınızı silemezsiniz' : 'Sil'}
        onClick={() => onDelete(user)}
        className="hover:!bg-danger/10 hover:!text-danger"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

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
  const [search, setSearch] = useState('');

  // Developer'ın grupla-göster arayüzü (Admin + ekibi tek blokta) tüm listeyi tek seferde
  // istemekle uyumludur — sayfa gezinmesi grupları böler. Bu yüzden sabit düşük bir limit
  // yerine, bu görünüm için pratikte hiç dolmayacak yüksek bir üst sınır kullanılır.
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users', restrictToUserRole ?? 'all'],
    queryFn: () => clientFetch<Paginated<PublicUser>>('/users?limit=2000'),
  });
  const users = data?.items;

  const matchesSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (u: PublicUser) =>
      !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  }, [search]);

  const searchedUsers = useMemo(() => {
    if (!users || !restrictToUserRole || !search.trim()) return users;
    return users.filter(matchesSearch);
  }, [users, restrictToUserRole, search, matchesSearch]);

  // Bir Admin silinirse, sahibi olduğu tüm depolar/ürünler DB'de cascade ile silinir
  // (Warehouse.owner → onDelete: Cascade). Onay diyaloğunda bunu somut sayılarla göstermek
  // için, sadece diyalog açıkken ve hedef bir Admin'ken bu depo listesi çekilir.
  const { data: deletingImpact } = useQuery({
    queryKey: ['warehouses', 'deletion-impact', deleting?.id],
    queryFn: () => clientFetch<Warehouse[]>(`/warehouses?ownerId=${deleting!.id}`),
    enabled: !!deleting && deleting.role === 'ADMIN',
  });
  const deletingWarehouseCount = deletingImpact?.length ?? 0;
  const deletingProductCount =
    deletingImpact?.reduce((sum, w) => sum + w.productCount, 0) ?? 0;

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

  /** Developer panelinde kullanıcılar tek bir liste yerine bağlı oldukları Admin'e göre gruplanır. */
  const { platformAdmins, adminGroups, unassigned } = useMemo(() => {
    const all = users ?? [];
    const admins = all.filter((u) => u.role === 'ADMIN');
    const regularUsers = all.filter((u) => u.role === 'USER');
    const adminIds = new Set(admins.map((a) => a.id));

    const groups = admins
      .map((admin) => ({
        admin,
        members: regularUsers.filter((u) => u.adminOwnerId === admin.id),
      }))
      .sort((a, b) => a.admin.name.localeCompare(b.admin.name, 'tr'));

    if (restrictToUserRole || !search.trim()) {
      return {
        platformAdmins: all.filter((u) => u.role === 'PLATFORM_ADMIN'),
        adminGroups: groups,
        unassigned: regularUsers.filter(
          (u) => !u.adminOwnerId || !adminIds.has(u.adminOwnerId),
        ),
      };
    }

    // Arama aktifken: Admin'in kendisi eşleşiyorsa tüm ekibiyle birlikte gösterilir;
    // sadece bir ekip üyesi eşleşiyorsa grup sadece o üye(ler)le daralır.
    return {
      platformAdmins: all.filter((u) => u.role === 'PLATFORM_ADMIN' && matchesSearch(u)),
      adminGroups: groups
        .filter((g) => matchesSearch(g.admin) || g.members.some(matchesSearch))
        .map((g) => ({
          admin: g.admin,
          members: matchesSearch(g.admin) ? g.members : g.members.filter(matchesSearch),
        })),
      unassigned: regularUsers
        .filter((u) => !u.adminOwnerId || !adminIds.has(u.adminOwnerId))
        .filter(matchesSearch),
    };
  }, [users, restrictToUserRole, search, matchesSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad veya kullanıcı adı ara…"
              className="w-56 pl-8"
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border bg-surface">
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState error={error as Error} reset={() => refetch()} />
        </div>
      ) : !users || users.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            icon={UserRound}
            title="Kullanıcı bulunamadı"
            description={restrictToUserRole ? 'Henüz bir kullanıcı hesabı oluşturulmadı.' : undefined}
          />
        </div>
      ) : restrictToUserRole ? (
        <div className="rounded-md border border-border bg-surface">
          {!searchedUsers || searchedUsers.length === 0 ? (
            <EmptyState icon={Search} title="Aramanızla eşleşen kullanıcı yok" />
          ) : (
          <Table>
            <Thead>
              <Th>Ad Soyad</Th>
              <Th>Kullanıcı Adı</Th>
              <Th>Durum</Th>
              <Th className="text-right">İşlemler</Th>
            </Thead>
            <Tbody>
              {searchedUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <Tr key={u.id}>
                    <Td className="font-medium">
                      {u.name}
                      {isSelf && <span className="ml-2 text-xs text-muted">(siz)</span>}
                    </Td>
                    <Td className="text-muted">{u.username}</Td>
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
      ) : search.trim() && platformAdmins.length === 0 && adminGroups.length === 0 && unassigned.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState icon={Search} title="Aramanızla eşleşen kullanıcı yok" />
        </div>
      ) : (
        <div className="space-y-4">
          {platformAdmins.length > 0 && (
            <div className="rounded-md border border-border bg-surface">
              <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted">
                <ShieldCheck size={13} />
                Platform Admin
              </div>
              <div className="divide-y divide-border">
                {platformAdmins.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-ink">{u.name}</span>
                      {u.id === currentUserId && <span className="text-xs text-muted">(siz)</span>}
                      <span className="truncate text-xs text-muted">({u.username})</span>
                    </div>
                    <UserActions
                      user={u}
                      currentUserId={currentUserId}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminGroups.map(({ admin, members }) => (
            <div key={admin.id} className="rounded-md border border-border bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge tone={ROLE_TONE.ADMIN} withIcon={false}>
                    {ROLE_LABEL.ADMIN}
                  </Badge>
                  <span className="truncate font-medium text-ink">{admin.name}</span>
                  {admin.id === currentUserId && <span className="text-xs text-muted">(siz)</span>}
                  <span className="truncate text-xs text-muted">({admin.username})</span>
                  <Badge tone="neutral" withIcon={false} className="ml-1">
                    <UsersIcon size={11} />
                    {members.length}
                  </Badge>
                </div>
                <UserActions
                  user={admin}
                  currentUserId={currentUserId}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              </div>

              {members.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted">Bu Admin'in ekibinde henüz bir kullanıcı yok.</p>
              ) : (
                <div className="divide-y divide-border">
                  {members.map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        'ml-4 flex items-center justify-between gap-3 border-l-2 border-accent/25 py-2.5 pl-6 pr-4',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-ink">{u.name}</span>
                        {u.id === currentUserId && <span className="text-xs text-muted">(siz)</span>}
                        <span className="truncate text-xs text-muted">({u.username})</span>
                      </div>
                      <UserActions
                        user={u}
                        currentUserId={currentUserId}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div className="rounded-md border border-dashed border-border bg-surface">
              <div className="border-b border-dashed border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted">
                Bağlı Admin'i olmayan kullanıcılar
              </div>
              <div className="divide-y divide-border">
                {unassigned.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-ink">{u.name}</span>
                      <span className="truncate text-xs text-muted">({u.username})</span>
                    </div>
                    <UserActions
                      user={u}
                      currentUserId={currentUserId}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          description={
            deleting.role === 'ADMIN'
              ? deletingImpact
                ? `"${deleting.name}" (${deleting.username}) hesabını kalıcı olarak silmek istediğinize emin misiniz? Bu Admin'e ait ${deletingWarehouseCount} depo ve içindeki toplam ${deletingProductCount} ürün de kalıcı olarak silinecek.`
                : `"${deleting.name}" (${deleting.username}) hesabını kalıcı olarak silmek istediğinize emin misiniz? Bu Admin'e ait tüm depolar ve içindeki ürünler de silinecek. (Etki hesaplanıyor…)`
              : `"${deleting.name}" (${deleting.username}) hesabını kalıcı olarak silmek istediğinize emin misiniz?`
          }
          confirmLabel="Sil"
          danger
        />
      )}
    </div>
  );
}
