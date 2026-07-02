import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/** Aktörün eriştiği depo havuzunun sahibi (Admin) kimliği. Platform Admin için null (sınır yok). */
export function ownerScopeFor(actor: User): string | null {
  if (actor.role === 'ADMIN') return actor.id;
  if (actor.role === 'USER') return actor.adminOwnerId;
  return null;
}

/** Aktörün erişebildiği tüm depo id'leri (Admin: kendi depoları, Kullanıcı: bağlı olduğu Admin'in depoları, Platform Admin: tümü). */
export async function getAccessibleWarehouseIds(
  prisma: PrismaService,
  actor: User,
): Promise<string[]> {
  if (actor.role === 'PLATFORM_ADMIN') {
    const all = await prisma.warehouse.findMany({ select: { id: true } });
    return all.map((w) => w.id);
  }
  const ownerId = ownerScopeFor(actor);
  if (!ownerId) return [];
  const warehouses = await prisma.warehouse.findMany({
    where: { ownerId },
    select: { id: true },
  });
  return warehouses.map((w) => w.id);
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
