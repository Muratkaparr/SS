'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifrenizi girin'),
    newPassword: z.string().min(1, 'Yeni şifre en az 1 karakter olmalı'),
    confirmPassword: z.string().min(1, 'Yeni şifrenizi tekrar girin'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Yeni şifreler eşleşmiyor',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);

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
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      clientFetch('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      }),
    onSuccess: () => {
      toast.success('Şifreniz güncellendi');
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Şifre Değiştir" className="max-w-sm">
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
          <Label htmlFor="current-password">Mevcut Şifre</Label>
          <Input id="current-password" type="password" {...register('currentPassword')} />
          <FieldError>{errors.currentPassword?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="new-password">Yeni Şifre</Label>
          <Input id="new-password" type="password" {...register('newPassword')} />
          <FieldError>{errors.newPassword?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirm-password">Yeni Şifre (tekrar)</Label>
          <Input id="confirm-password" type="password" {...register('confirmPassword')} />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Şifreyi Güncelle
          </Button>
        </div>
      </form>
    </Modal>
  );
}
