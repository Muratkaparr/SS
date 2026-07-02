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

const schema = z.object({
  name: z.string().min(2, 'Depo adı en az 2 karakter olmalı'),
  location: z.string().optional(),
  ownerId: z.string().min(1, 'Bir Admin seçilmeli'),
});

type FormValues = z.infer<typeof schema>;

export function WarehouseFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => clientFetch<PublicUser[]>('/users'),
    enabled: open,
  });
  const admins = users?.filter((u) => u.role === 'ADMIN') ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal her açıldığında formu sıfırla
      setServerError(null);
      reset({ name: '', location: '', ownerId: '' });
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      clientFetch('/warehouses', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      toast.success('Depo oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Yeni Depo" className="max-w-sm">
      <form
        onSubmit={handleSubmit((v) => {
          setServerError(null);
          mutation.mutate(v);
        })}
        className="space-y-4"
      >
        {serverError && (
          <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
        )}
        <div>
          <Label htmlFor="wh-owner">Admin</Label>
          <Select id="wh-owner" {...register('ownerId')}>
            <option value="">Admin seçin…</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.email})
              </option>
            ))}
          </Select>
          <FieldError>{errors.ownerId?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="wh-name">Depo Adı</Label>
          <Input id="wh-name" placeholder="Örn. Güney Depo" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="wh-location">Konum (opsiyonel)</Label>
          <Input id="wh-location" placeholder="Örn. İzmir, Türkiye" {...register('location')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Depo Oluştur
          </Button>
        </div>
      </form>
    </Modal>
  );
}
