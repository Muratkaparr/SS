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
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { WarehouseTreeNav } from './warehouse-tree-nav';

export type PanelKey = 'user' | 'admin' | 'developer';

const PRODUCTS_HREF: Record<PanelKey, string | null> = {
  user: '/panel/products',
  admin: '/admin/products',
  developer: null,
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: Record<PanelKey, NavItem[]> = {
  user: [
    { href: '/panel', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/panel/products', label: 'Ürünler', icon: Package },
    { href: '/panel/orders', label: 'Siparişler', icon: ShoppingCart },
  ],
  admin: [
    { href: '/admin', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/admin/products', label: 'Ürünler', icon: Package },
    { href: '/admin/movements', label: 'Stok Hareketleri', icon: ArrowLeftRight },
    { href: '/admin/orders', label: 'Siparişler', icon: ShoppingCart },
    { href: '/admin/users', label: 'Kullanıcılar', icon: Users },
    { href: '/admin/activity', label: 'Kullanıcı Aktiviteleri', icon: Activity },
  ],
  developer: [
    { href: '/developer', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/developer/products', label: 'Ürünler', icon: Package },
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
        const isProductsItem = item.href === PRODUCTS_HREF[panel];
        return (
          <div key={item.href}>
            <Link
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
            {isProductsItem && (panel === 'admin' || panel === 'user') && (
              <WarehouseTreeNav basePath={item.href} canManage={panel === 'admin'} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
