'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowLeftRight,
  Building2,
  LayoutDashboard,
  Package,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type PanelKey = 'user' | 'admin' | 'developer';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: Record<PanelKey, NavItem[]> = {
  user: [
    { href: '/panel', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/panel/products', label: 'Ürünler', icon: Package },
  ],
  admin: [
    { href: '/admin', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/admin/products', label: 'Ürünler', icon: Package },
    { href: '/admin/movements', label: 'Stok Hareketleri', icon: ArrowLeftRight },
    { href: '/admin/users', label: 'Kullanıcılar', icon: Users },
    { href: '/admin/activity', label: 'Kullanıcı Aktiviteleri', icon: Activity },
  ],
  developer: [
    { href: '/developer', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/developer/warehouses', label: 'Depolar', icon: Building2 },
    { href: '/developer/users', label: 'Kullanıcılar', icon: Users },
    { href: '/developer/logs', label: 'Sistem Logları', icon: ScrollText },
  ],
};

export function SidebarNav({ panel }: { panel: PanelKey }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[panel];

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out-quart',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
