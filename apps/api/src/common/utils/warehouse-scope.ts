import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/** Aktörün eriştiği depo havuzunun sahibi (Admin) kimliği. Platform Admin için null (sınır yok). */
export function ownerScopeFor(actor: User): string | null {
  if (actor.role === 'ADMIN') return actor.id;
  if (actor.role === 'USER') return actor.adminOwnerId;
  return null;
}

interface WarehouseTreeNode {
  id: string;
  parentId: string | null;
  includeInParentTotal: boolean;
}

/**
 * Verilen kök id'lerden başlayarak depo ağacında BFS ile alt ağacı toplar (kökler dahil).
 * `onlyIncluded` true iken, includeInParentTotal=false olan bir dal (ve onun altındaki
 * her şey) toplama dahil edilmez — "Ana Depoya Dahil Et/Çıkar" tikinin uygulandığı yer.
 */
function collectSubtreeIds(
  allWarehouses: WarehouseTreeNode[],
  rootIds: string[],
  onlyIncluded: boolean,
): Set<string> {
  const childrenByParent = new Map<string, WarehouseTreeNode[]>();
  for (const w of allWarehouses) {
    if (!w.parentId) continue;
    const list = childrenByParent.get(w.parentId) ?? [];
    list.push(w);
    childrenByParent.set(w.parentId, list);
  }

  const result = new Set<string>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of childrenByParent.get(id) ?? []) {
      if (onlyIncluded && !child.includeInParentTotal) continue;
      queue.push(child.id);
    }
  }
  return result;
}

/** Bir deponun (rootId dahil) tüm alt ağacındaki id'leri döner (sahibinden bağımsız erişim kontrolü yapmaz). */
export async function getWarehouseSubtreeIds(
  prisma: PrismaService,
  rootId: string,
  options: { onlyIncluded?: boolean } = {},
): Promise<string[]> {
  const root = await prisma.warehouse.findUnique({
    where: { id: rootId },
    select: { ownerId: true },
  });
  if (!root) return [rootId];

  const allWarehouses = await prisma.warehouse.findMany({
    where: { ownerId: root.ownerId },
    select: { id: true, parentId: true, includeInParentTotal: true },
  });

  return Array.from(
    collectSubtreeIds(allWarehouses, [rootId], options.onlyIncluded ?? false),
  );
}

/** Aktörün erişebildiği tüm depo id'leri (ürün/stok GİZLİLİĞİ için kullanılan dar kapsam). */
export async function getAccessibleWarehouseIds(
  prisma: PrismaService,
  actor: User,
): Promise<string[]> {
  // SUPPLIER, depo sahipliğine bağlı değildir — onaylanmış her siparişi (hangi
  // Admin'e ait olursa olsun) tedarik edebilmesi için PLATFORM_ADMIN gibi sınırsız erişir.
  if (actor.role === 'PLATFORM_ADMIN' || actor.role === 'SUPPLIER') {
    const all = await prisma.warehouse.findMany({ select: { id: true } });
    return all.map((w) => w.id);
  }

  const ownerId = ownerScopeFor(actor);
  if (!ownerId) return [];

  const allWarehouses = await prisma.warehouse.findMany({
    where: { ownerId },
    select: { id: true, parentId: true, includeInParentTotal: true },
  });

  // ADMIN her zaman kendi tüm depo havuzuna sınırsız erişir — depo bazlı kısıt yok.
  if (actor.role !== 'USER') {
    return allWarehouses.map((w) => w.id);
  }

  const grants = await prisma.warehouseAccess.findMany({
    where: { userId: actor.id },
    select: { warehouseId: true },
  });

  // Hiç açık izin yoksa: geriye dönük uyumlu davranış — adminin tüm depo havuzu.
  if (grants.length === 0) {
    return allWarehouses.map((w) => w.id);
  }

  // İzin verilmişse: SADECE verilen depo(lar) + onların tüm alt ağacı.
  const grantedIds = grants.map((g) => g.warehouseId);
  return Array.from(collectSubtreeIds(allWarehouses, grantedIds, false));
}

/**
 * Gezinme (sekme/sidebar ağacı) için: erişilebilir depolara ek olarak, izin verilen
 * depoların ata (ancestor) zincirini de içerir — derinde yetkilendirilen bir depoya
 * "içinden geçerek" ulaşılabilsin diye. Ürün/stok sorgularında KULLANILMAMALI — sadece
 * WarehousesService.findAll gibi liste/ağaç uçlarında.
 */
export async function getNavigableWarehouseIds(
  prisma: PrismaService,
  actor: User,
): Promise<string[]> {
  const accessible = await getAccessibleWarehouseIds(prisma, actor);
  if (actor.role !== 'USER') return accessible;

  const ownerId = ownerScopeFor(actor);
  if (!ownerId) return accessible;

  const grants = await prisma.warehouseAccess.findMany({
    where: { userId: actor.id },
    select: { warehouseId: true },
  });
  if (grants.length === 0) return accessible;

  const allWarehouses = await prisma.warehouse.findMany({
    where: { ownerId },
    select: { id: true, parentId: true },
  });
  const byId = new Map(allWarehouses.map((w) => [w.id, w]));

  const result = new Set(accessible);
  for (const grant of grants) {
    let current = byId.get(grant.warehouseId);
    while (current?.parentId) {
      result.add(current.parentId);
      current = byId.get(current.parentId);
    }
  }
  return Array.from(result);
}

/** Belirli bir depoya erişimi doğrular ve id'yi döner; erişimi yoksa 403. */
export async function assertWarehouseAccess(
  prisma: PrismaService,
  actor: User,
  warehouseId: string,
): Promise<string> {
  if (actor.role === 'PLATFORM_ADMIN') return warehouseId;
  const accessible = await getAccessibleWarehouseIds(prisma, actor);
  if (!accessible.includes(warehouseId)) {
    throw new ForbiddenException('Bu depoya erişiminiz yok');
  }
  return warehouseId;
}
