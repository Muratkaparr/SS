import { CENTRAL_WAREHOUSE_NAME } from '@/lib/warehouse-constants';
import type { Product } from '@/lib/types';

/**
 * "Bütün Ürünler" görünümünde, farklı depolardaki aynı isme sahip ürünleri tek satırda
 * toplar (stok toplanır). Kritik seviye TOPLANMAZ ve tek bir temsilci değere indirgenmez —
 * her depo kendi kritik seviyesini `mergedWarehouses` içinde taşımaya devam eder, çünkü
 * depolar arası eşiklerin toplamı/ortalaması anlamlı bir sayı değildir (bkz. isProductCritical).
 * Gösterimde varsa "Merkez Depo" satırı temsilci seçilir; düzenleme/silme gibi aksiyonlar
 * da bu temsilci ürün üzerinden çalışmaya devam eder.
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
        criticalLevel: p.criticalLevel,
      })),
    };
  });
}

/**
 * Birleştirilmiş bir satırda TOPLAM stoğu temsilci depronun tek eşiğiyle kıyaslamak yanlış
 * sonuç verir: örn. 3 depoda da (eşik 10, stok 5) gerçekte hepsi kritikken toplam stok 15,
 * tek eşik 10 ile "kritik değil" çıkar. Bu yüzden birleştirilmiş satırlarda kriticality, alt
 * depolardan EN AZ BİRİNİN kendi eşiğine göre kritik olup olmadığına (OR) bakılarak belirlenir.
 */
export function isProductCritical(product: Product): boolean {
  if (product.mergedWarehouses && product.mergedWarehouses.length > 0) {
    return product.mergedWarehouses.some(
      (w) => w.criticalLevel > 0 && w.stock <= w.criticalLevel,
    );
  }
  return product.criticalLevel > 0 && product.currentStock <= product.criticalLevel;
}
