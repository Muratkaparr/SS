'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';

const schema = z.object({
  username: z.string().min(1, 'Kullanıcı adı gerekli'),
  password: z.string().min(1, 'Şifre en az 1 karakter olmalı'),
});

type FormValues = z.infer<typeof schema>;

const ROLE_HOME: Record<string, string> = {
  USER: '/panel',
  ADMIN: '/admin',
  PLATFORM_ADMIN: '/developer',
};

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Giriş başarısız' }));
      setServerError(body.message ?? 'Kullanıcı adı veya şifre hatalı');
      return;
    }
    const data = await res.json();
    router.push(ROLE_HOME[data.user.role] ?? '/login');
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-ink">
            <Warehouse size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Depo Takip Sistemi</h1>
            <p className="mt-1 text-sm text-muted">Devam etmek için giriş yapın</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-md border border-border bg-surface p-6"
        >
          {serverError && (
            <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">
              {serverError}
            </p>
          )}

          <div>
            <Label htmlFor="username">Kullanıcı Adı</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="kullaniciadi"
              error={errors.username?.message}
              {...register('username')}
            />
            <FieldError>{errors.username?.message}</FieldError>
          </div>

          <div>
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <FieldError>{errors.password?.message}</FieldError>
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Giriş yap
          </Button>
        </form>
      </div>
    </div>
  );
}
