'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Role, type PublicUser } from '@repo/shared-types';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated } from '@/lib/types';

const ROLE_LABEL: Record<Role, string> = {
  [Role.USER]: 'Kullanıcı',
  [Role.ADMIN]: 'Admin',
  [Role.PLATFORM_ADMIN]: 'Platform Admin (Developer)',
};

const createBaseSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalı'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  role: z.nativeEnum(Role),
  adminOwnerId: z.string().optional(),
});

const editBaseSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  // Sadece Platform Admin (developer paneli) değiştirebilir; admin panelinde salt-okunur gösterilir.
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalı').optional(),
  role: z.nativeEnum(Role),
  isActive: z.boolean(),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı').optional().or(z.literal('')),
  adminOwnerId: z.string().optional(),
});

// Admin panelinden (restrictToUserRole) çağrıldığında "Bağlı Admin" alanı hiç gösterilmez —
// backend zaten otomatik atar — bu yüzden bu durumda zorunlu tutmuyoruz.
const adminOwnerRule = (v: { role: Role; adminOwnerId?: string }) =>
  v.role !== Role.USER || !!v.adminOwnerId;
const adminOwnerRuleOptions = {
  message: '"Kullanıcı" rolü için bir Admin seçilmeli',
  path: ['adminOwnerId'],
};

function buildCreateSchema(restrictToUserRole?: boolean) {
  if (restrictToUserRole) return createBaseSchema;
  return createBaseSchema.refine(adminOwnerRule, adminOwnerRuleOptions);
}

function buildEditSchema(restrictToUserRole?: boolean) {
  if (restrictToUserRole) return editBaseSchema;
  return editBaseSchema.refine(adminOwnerRule, adminOwnerRuleOptions);
}

type CreateValues = z.infer<typeof createBaseSchema>;
type EditValues = z.infer<typeof editBaseSchema>;

export function UserFormModal({
  open,
  onClose,
  user,
  isSelf,
  /** Admin panelinden kullanılıyorsa true — rol her zaman "Kullanıcı" ile sabitlenir, ekip her zaman kendisidir. */
  restrictToUserRole,
}: {
  open: boolean;
  onClose: () => void;
  user?: PublicUser;
  isSelf?: boolean;
  restrictToUserRole?: boolean;
}) {
  const isEdit = !!user;
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => clientFetch<Paginated<PublicUser>>('/users?limit=200'),
    enabled: open && !restrictToUserRole,
  });
  const admins = usersData?.items.filter((u) => u.role === Role.ADMIN) ?? [];

  const createSchema = useMemo(() => buildCreateSchema(restrictToUserRole), [restrictToUserRole]);
  const editSchema = useMemo(() => buildEditSchema(restrictToUserRole), [restrictToUserRole]);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: Role.USER },
  });
  const editForm = useForm<EditValues>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (open) {
      setServerError(null);
      if (user) {
        editForm.reset({
          name: user.name,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
          password: '',
          adminOwnerId: user.adminOwnerId ?? undefined,
        });
      } else {
        createForm.reset({ name: '', username: '', password: '', role: Role.USER, adminOwnerId: undefined });
      }
    }
  }, [open, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) =>
      clientFetch('/users', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success('Kullanıcı oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  const editMutation = useMutation({
    mutationFn: (values: EditValues) =>
      clientFetch(`/users/${user!.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...values, password: values.password || undefined }),
      }),
    onSuccess: () => {
      toast.success('Kullanıcı güncellendi');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  const roleFieldDisabled = isSelf || restrictToUserRole;
  const editRole = editForm.watch('role');
  const createRole = createForm.watch('role');

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'} className="max-w-md">
      {isEdit ? (
        <form
          onSubmit={editForm.handleSubmit((v) => {
            setServerError(null);
            editMutation.mutate(v);
          })}
          className="space-y-4"
        >
          {serverError && (
            <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
          )}
          <div>
            <Label htmlFor="edit-name">Ad Soyad</Label>
            <Input id="edit-name" {...editForm.register('name')} />
            <FieldError>{editForm.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="edit-username">Kullanıcı Adı</Label>
            {restrictToUserRole ? (
              <Input value={user!.username} disabled />
            ) : (
              <>
                <Input id="edit-username" {...editForm.register('username')} />
                <FieldError>{editForm.formState.errors.username?.message}</FieldError>
              </>
            )}
          </div>
          {!restrictToUserRole && (
            <div>
              <Label htmlFor="edit-role">Rol</Label>
              <Select id="edit-role" disabled={roleFieldDisabled} {...editForm.register('role')}>
                {Object.values(Role).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              {isSelf && <p className="mt-1 text-xs text-muted">Kendi rolünüzü değiştiremezsiniz.</p>}
            </div>
          )}
          {!restrictToUserRole && editRole === Role.USER && (
            <div>
              <Label htmlFor="edit-owner">Bağlı Admin</Label>
              <Select id="edit-owner" {...editForm.register('adminOwnerId')}>
                <option value="">Admin seçin…</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.username})
                  </option>
                ))}
              </Select>
              <FieldError>{editForm.formState.errors.adminOwnerId?.message}</FieldError>
            </div>
          )}
          {restrictToUserRole && (
            <p className="rounded-sm bg-surface-2 px-3 py-2 text-xs text-muted">
              Bu kullanıcı sizin ekibinize atanmıştır ve tüm depolarınızı görür.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              disabled={isSelf}
              {...editForm.register('isActive')}
              className="h-4 w-4 rounded-sm border-border accent-primary"
            />
            Hesap aktif
          </label>
          <div>
            <Label htmlFor="edit-password">Yeni Şifre (opsiyonel)</Label>
            <Input id="edit-password" type="password" placeholder="Değiştirmek için doldurun" {...editForm.register('password')} />
            <FieldError>{editForm.formState.errors.password?.message}</FieldError>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" loading={editMutation.isPending}>
              Kaydet
            </Button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={createForm.handleSubmit((v) => {
            setServerError(null);
            createMutation.mutate(v);
          })}
          className="space-y-4"
        >
          {serverError && (
            <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
          )}
          <div>
            <Label htmlFor="create-name">Ad Soyad</Label>
            <Input id="create-name" {...createForm.register('name')} />
            <FieldError>{createForm.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="create-username">Kullanıcı Adı</Label>
            <Input id="create-username" type="text" {...createForm.register('username')} />
            <FieldError>{createForm.formState.errors.username?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="create-password">Şifre</Label>
            <Input id="create-password" type="password" {...createForm.register('password')} />
            <FieldError>{createForm.formState.errors.password?.message}</FieldError>
          </div>
          {!restrictToUserRole && (
            <div>
              <Label htmlFor="create-role">Rol</Label>
              <Select id="create-role" {...createForm.register('role')}>
                {Object.values(Role).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {!restrictToUserRole && createRole === Role.USER && (
            <div>
              <Label htmlFor="create-owner">Bağlı Admin</Label>
              <Select id="create-owner" defaultValue="" {...createForm.register('adminOwnerId')}>
                <option value="">Admin seçin…</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.username})
                  </option>
                ))}
              </Select>
              <FieldError>{createForm.formState.errors.adminOwnerId?.message}</FieldError>
            </div>
          )}
          {restrictToUserRole && (
            <p className="rounded-sm bg-surface-2 px-3 py-2 text-xs text-muted">
              Bu kullanıcı otomatik olarak ekibinize atanacak ve tüm depolarınızı görecektir.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Kullanıcı Oluştur
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
