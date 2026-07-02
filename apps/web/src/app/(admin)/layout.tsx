import { PanelShell } from '@/components/layout/panel-shell';
import { serverFetch } from '@/lib/server-fetch';
import type { PublicUser } from '@repo/shared-types';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await serverFetch<PublicUser>('/auth/me');

  return (
    <PanelShell panel="admin" panelLabel="Admin Paneli" userName={user.name}>
      {children}
    </PanelShell>
  );
}
