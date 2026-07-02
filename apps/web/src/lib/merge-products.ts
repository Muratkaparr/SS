import { CENTRAL_WAREHOUSE_NAME } from '@/lib/warehouse-constants';
import type { Product } from '@/lib/types';

/**
 * "Bütün Ürünler" görünümünde, farklı depolardaki aynı isme sahip ürünleri tek satırda
 * toplar (stok toplanır). Kritik seviye toplanmaz — varsa "Merkez Depo" satırı temsilci
 * olarak seçilir ve kendi yazılan kritik seviye değeri aynen gösterilir; düzenleme/silme
 * gibi aksiyonlar da bu temsilci ürün üzerinden çalışmaya devam eder.
 */
export function mergeByName(products: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const group = groups.get(product.name);
    if (group) group.push(product);
    else groups.set(product.name, [product]);
  }

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    const central = group.find((p) => p.warehouse?.name === CENTRAL_WAREHOUSE_NAME);
    const representative = central ?? group[0];

    return {
      ...representative,
      currentStock: group.reduce((sum, p) => sum + p.currentStock, 0),
      mergedWarehouses: group.map((p) => ({
        id: p.warehouseId,
        productId: p.id,
        name: p.warehouse?.name ?? '—',
        stock: p.currentStock,
      })),
    };
  });
}

export function isProductCritical(product: Product): boolean {
  return product.currentStock <= product.criticalLevel;
}
