'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { ChangePasswordModal } from '@/components/layout/change-password-modal';
import { ThemeToggle } from '@/components/theme-toggle';

export function TopbarActions({ userName }: { userName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch {
      toast.error('Çıkış yapılamadı, tekrar deneyin');
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted sm:inline">{userName}</span>
      <ThemeToggle />
      <button
        type="button"
        onClick={() => setChangePasswordOpen(true)}
        aria-label="Şifre değiştir"
        title="Şifre değiştir"
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <KeyRound size={17} />
      </button>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        aria-label="Çıkış yap"
        title="Çıkış yap"
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        <LogOut size={17} />
      </button>
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  );
}
