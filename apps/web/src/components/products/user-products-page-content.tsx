'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { WarehouseTabs } from '@/components/products/warehouse-tabs';
import { ErrorState } from '@/components/ui/error-state';
import { useWarehouseContext } from '@/lib/use-warehouse-context';
import { ALL_WAREHOUSES_ID } from '@/lib/warehouse-constants';

export function UserProductsPageContent({ path }: { path: string[] }) {
  const router = useRouter();
  const { currentParentId, breadcrumb, allLabel, preselectedWarehouseId, contextError } =
    useWarehouseContext(path);

  // Kullanıcının bu bağlamda ELLE seçtiği sekme; bağlam (path) değişince sıfırlanır.
  const [manualWarehouseId, setManualWarehouseId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bağlam değişince manuel seçim sıfırlanmalı
    setManualWarehouseId(null);
  }, [currentParentId, preselectedWarehouseId]);

  // Sidebar'dan doğrudan bir yaprak depoya girildiyse o depo önceden seçili gelir; aksi
  // halde bağlamın birleşik "Bütün Ürünler" görünümü varsayılandır — senkron hesaplanır,
  // bir effect'in "düzeltmesini" beklemez, ekran hiçbir zaman boş kalmaz.
  const activeWarehouseId = manualWarehouseId ?? preselectedWarehouseId ?? ALL_WAREHOUSES_ID;

  if (contextError) {
    return (
      <ErrorState
        error={
          new Error(
            'Bu depoya artık erişilemiyor — silinmiş, taşınmış veya erişim yetkiniz kaldırılmış olabilir.',
          )
        }
        reset={() => router.push('/panel/products')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {path.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <Link href="/panel/products" className="hover:text-ink hover:underline">
            Ürünler
          </Link>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight size={14} />
              {i === breadcrumb.length - 1 ? (
                <span className="font-medium text-ink">{b.name ?? '…'}</span>
              ) : (
                <Link
                  href={`/panel/products/warehouse/${path.slice(0, i + 1).join('/')}`}
                  className="hover:text-ink hover:underline"
                >
                  {b.name ?? '…'}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      <div>
        <h1 className="text-xl font-semibold text-ink">Ürünler</h1>
        <p className="mt-1 text-sm text-muted">
          Depolar arasında sekmelerle geçiş yapın. Bu görünüm salt okunur — düzenleme yetkiniz
          bulunmuyor.
        </p>
      </div>

      <WarehouseTabs
        activeId={activeWarehouseId}
        onChange={setManualWarehouseId}
        parentId={currentParentId}
        allLabel={allLabel}
      />

      {activeWarehouseId && (
        <ProductsExplorer
          view="grid"
          fixedWarehouseId={activeWarehouseId}
          parentAggregateId={currentParentId ?? undefined}
        />
      )}
    </div>
  );
}
