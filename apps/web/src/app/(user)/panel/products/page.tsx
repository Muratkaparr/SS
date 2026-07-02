'use client';

import { useState } from 'react';
import { ProductsExplorer } from '@/components/products/products-explorer';
import { WarehouseTabs } from '@/components/products/warehouse-tabs';

export default function UserProductsPage() {
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Ürünler</h1>
        <p className="mt-1 text-sm text-muted">
          Depolar arasında sekmelerle geçiş yapın. Kartlardaki +/− ile stok miktarını
          güncelleyebilirsiniz.
        </p>
      </div>

      <WarehouseTabs activeId={activeWarehouseId} onChange={setActiveWarehouseId} />

      {activeWarehouseId && (
        <ProductsExplorer view="grid" canAdjustStock fixedWarehouseId={activeWarehouseId} />
      )}
    </div>
  );
}
