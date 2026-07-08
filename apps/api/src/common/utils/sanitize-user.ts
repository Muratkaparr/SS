import type { User } from '@prisma/client';
import type { PublicUser } from '@repo/shared-types';

type UserWithAdminOwner = User & {
  adminOwner?: { id: string; name: string } | null;
  warehouseAccess?: { warehouseId: string }[];
};

export function sanitizeUser(user: UserWithAdminOwner): PublicUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as PublicUser['role'],
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    adminOwnerId: user.adminOwnerId,
    adminOwnerName: user.adminOwner?.name ?? null,
    rootAllWarehousesLabel: user.rootAllWarehousesLabel,
    warehouseAccessIds: user.warehouseAccess?.map((g) => g.warehouseId) ?? [],
  };
}
