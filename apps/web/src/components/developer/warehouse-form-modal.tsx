'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { PublicUser } from '@repo/shared-types';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Paginated, Warehouse } from '@/lib/types';

const createSchema = z.object({
  name: z.string().min(2, 'Depo adı en az 2 karakter olmalı'),
  location: z.string().optional(),
  ownerId: z.string().min(1, 'Bir Admin seçilmeli'),
});

const editSchema = z.object({
  name: z.string().min(2, 'Depo adı en az 2 karakter olmalı'),
  location: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

export function WarehouseFormModal({
  open,
  onClose,
  warehouse,
}: {
  open: boolean;
  onClose: () => void;
  /** Doluysa düzenleme modu — sadece isim/konum değiştirilebilir, sahip değiştirilemez. */
  warehouse?: Warehouse;
}) {
  const isEdit = !!warehouse;
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => clientFetch<Paginated<PublicUser>>('/users?limit=200'),
    enabled: open && !isEdit,
  });
  const admins = usersData?.items.filter((u) => u.role === 'ADMIN') ?? [];

  const createForm = useForm<CreateValues>({ resolver: zodResolver(createSchema) });
  const editForm = useForm<EditValues>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal her açıldığında formu sıfırla
      setServerError(null);
      if (warehouse) {
        editForm.reset({ name: warehouse.name, location: warehouse.location ?? '' });
      } else {
        createForm.reset({ name: '', location: '', ownerId: '' });
      }
    }
  }, [open, warehouse]); // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) =>
      clientFetch('/warehouses', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success('Depo oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  const editMutation = useMutation({
    mutationFn: (values: EditValues) =>
      clientFetch(`/warehouses/${warehouse!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      toast.success('Depo güncellendi');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Depoyu Düzenle' : 'Yeni Depo'} className="max-w-sm">
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
            <Label htmlFor="wh-edit-name">Depo Adı</Label>
            <Input id="wh-edit-name" {...editForm.register('name')} />
            <FieldError>{editForm.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="wh-edit-location">Konum (opsiyonel)</Label>
            <Input id="wh-edit-location" {...editForm.register('location')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" loading={editForm.formState.isSubmitting || editMutation.isPending}>
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
            <Label htmlFor="wh-owner">Admin</Label>
            <Select id="wh-owner" {...createForm.register('ownerId')}>
              <option value="">Admin seçin…</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.username})
                </option>
              ))}
            </Select>
            <FieldError>{createForm.formState.errors.ownerId?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="wh-name">Depo Adı</Label>
            <Input id="wh-name" placeholder="Örn. Güney Depo" {...createForm.register('name')} />
            <FieldError>{createForm.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="wh-location">Konum (opsiyonel)</Label>
            <Input id="wh-location" placeholder="Örn. İzmir, Türkiye" {...createForm.register('location')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" loading={createForm.formState.isSubmitting || createMutation.isPending}>
              Depo Oluştur
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
