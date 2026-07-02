import { Warehouse } from 'lucide-react';
import { SidebarNav, type PanelKey } from './sidebar-nav';
import { TopbarActions } from './topbar-actions';

export function PanelShell({
  panel,
  panelLabel,
  userName,
  children,
}: {
  panel: PanelKey;
  panelLabel: string;
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-2 md:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-ink">
            <Warehouse size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-ink">Depo Takip</p>
            <p className="text-xs leading-tight text-muted">{panelLabel}</p>
          </div>
        </div>
        <SidebarNav panel={panel} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <p className="text-sm font-medium text-ink md:hidden">Depo Takip</p>
          <div className="hidden md:block" />
          <TopbarActions userName={userName} />
        </header>
        <div className="border-b border-border bg-surface-2 py-2 md:hidden">
          <SidebarNav panel={panel} />
        </div>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
