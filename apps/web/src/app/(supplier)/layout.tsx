import { PanelShell } from '@/components/layout/panel-shell';
import { serverFetch } from '@/lib/server-fetch';
import type { PublicUser } from '@repo/shared-types';

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const user = await serverFetch<PublicUser>('/auth/me');

  return (
    <PanelShell panel="supplier" panelLabel="Tedarikçi Paneli" userName={user.name}>
      {children}
    </PanelShell>
  );
}
