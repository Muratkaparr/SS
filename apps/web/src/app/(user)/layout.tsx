import { PanelShell } from '@/components/layout/panel-shell';
import { serverFetch } from '@/lib/server-fetch';
import type { PublicUser } from '@repo/shared-types';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await serverFetch<PublicUser>('/auth/me');

  return (
    <PanelShell panel="user" panelLabel="Kullanıcı Paneli" userName={user.name}>
      {children}
    </PanelShell>
  );
}
