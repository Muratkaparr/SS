import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  assertWarehouseAccess,
  getAccessibleWarehouseIds,
  getNavigableWarehouseIds,
  getWarehouseSubtreeIds,
} from './warehouse-scope';

const USER = {
  id: 'user-1',
  role: 'USER',
  adminOwnerId: 'admin-1',
} as User;

const ADMIN = {
  id: 'admin-1',
  role: 'ADMIN',
  adminOwnerId: null,
} as User;

const PLATFORM_ADMIN = {
  id: 'platform-1',
  role: 'PLATFORM_ADMIN',
  adminOwnerId: null,
} as User;

// Ağaç: root-A > child-A1 > grandchild-A1a ; root-B (kardeş, ilgisiz).
const TREE = [
  { id: 'root-A', parentId: null, includeInParentTotal: true },
  { id: 'child-A1', parentId: 'root-A', includeInParentTotal: true },
  { id: 'grandchild-A1a', parentId: 'child-A1', includeInParentTotal: true },
  { id: 'root-B', parentId: null, includeInParentTotal: true },
];

function makePrisma(grants: { warehouseId: string }[] = []) {
  return {
    warehouse: {
      findMany: jest.fn().mockResolvedValue(TREE),
      findUnique: jest.fn(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(
          TREE.find((w) => w.id === id) ? { ownerId: 'admin-1' } : null,
        ),
      ),
    },
    warehouseAccess: {
      findMany: jest.fn().mockResolvedValue(grants),
    },
  } as any;
}

describe('warehouse-scope', () => {
  describe('getAccessibleWarehouseIds', () => {
    it('returns the whole owner pool when a USER has no explicit grants (legacy default)', async () => {
      const prisma = makePrisma([]);
      const ids = await getAccessibleWarehouseIds(prisma, USER);
      expect(ids.sort()).toEqual(
        ['root-A', 'child-A1', 'grandchild-A1a', 'root-B'].sort(),
      );
    });

    it('restricts a USER to a granted warehouse plus its descendants only', async () => {
      const prisma = makePrisma([{ warehouseId: 'child-A1' }]);
      const ids = await getAccessibleWarehouseIds(prisma, USER);
      expect(ids.sort()).toEqual(['child-A1', 'grandchild-A1a'].sort());
      expect(ids).not.toContain('root-A');
      expect(ids).not.toContain('root-B');
    });

    it('gives an ADMIN unrestricted access to their whole pool, ignoring any grants', async () => {
      // ADMIN hesapları için WarehouseAccess kavramı yok — sadece USER kısıtlanabilir.
      const prisma = makePrisma([{ warehouseId: 'child-A1' }]);
      const ids = await getAccessibleWarehouseIds(prisma, ADMIN);
      expect(ids.sort()).toEqual(
        ['root-A', 'child-A1', 'grandchild-A1a', 'root-B'].sort(),
      );
    });

    it('gives a PLATFORM_ADMIN every warehouse across all owners, not just one pool', async () => {
      const crossOwnerTree = [
        ...TREE,
        { id: 'other-owner-root', parentId: null, includeInParentTotal: true },
      ];
      const prisma = {
        warehouse: {
          findMany: jest.fn().mockResolvedValue(crossOwnerTree),
        },
      } as any;
      const ids = await getAccessibleWarehouseIds(prisma, PLATFORM_ADMIN);
      expect(ids.sort()).toEqual(
        [...crossOwnerTree.map((w) => w.id)].sort(),
      );
      // PLATFORM_ADMIN dalı `where` filtresi olmadan sorgulamalı — tek bir owner'a daraltılmamalı.
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
        select: { id: true },
      });
    });

    it('access is unaffected by includeInParentTotal=false — that flag only controls aggregate totals, not visibility', async () => {
      // child-A1'in ÜZERİNDE includeInParentTotal=false olsa bile, child-A1'e doğrudan
      // izin verilmişse USER onu ve alt ağacını görebilmeli.
      const excludedTree = [
        { id: 'root-A', parentId: null, includeInParentTotal: true },
        { id: 'child-A1', parentId: 'root-A', includeInParentTotal: false },
        {
          id: 'grandchild-A1a',
          parentId: 'child-A1',
          includeInParentTotal: true,
        },
      ];
      const prisma = {
        warehouse: {
          findMany: jest.fn().mockResolvedValue(excludedTree),
        },
        warehouseAccess: {
          findMany: jest.fn().mockResolvedValue([{ warehouseId: 'child-A1' }]),
        },
      } as any;
      const ids = await getAccessibleWarehouseIds(prisma, USER);
      expect(ids.sort()).toEqual(['child-A1', 'grandchild-A1a'].sort());
    });
  });

  describe('assertWarehouseAccess', () => {
    it('always passes for PLATFORM_ADMIN without querying grants', async () => {
      const prisma = makePrisma([]);
      await expect(
        assertWarehouseAccess(prisma, PLATFORM_ADMIN, 'root-B'),
      ).resolves.toBe('root-B');
      expect(prisma.warehouseAccess.findMany).not.toHaveBeenCalled();
    });

    it('resolves for a USER when the warehouse is within their accessible set', async () => {
      const prisma = makePrisma([{ warehouseId: 'child-A1' }]);
      await expect(
        assertWarehouseAccess(prisma, USER, 'grandchild-A1a'),
      ).resolves.toBe('grandchild-A1a');
    });

    it('throws ForbiddenException for a USER outside their granted subtree (the IDOR case)', async () => {
      const prisma = makePrisma([{ warehouseId: 'child-A1' }]);
      await expect(
        assertWarehouseAccess(prisma, USER, 'root-B'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getNavigableWarehouseIds', () => {
    it('adds the ancestor chain of a deep grant so it stays reachable in the tree/tabs', async () => {
      const prisma = makePrisma([{ warehouseId: 'grandchild-A1a' }]);
      const ids = await getNavigableWarehouseIds(prisma, USER);
      expect(ids.sort()).toEqual(
        ['grandchild-A1a', 'child-A1', 'root-A'].sort(),
      );
      expect(ids).not.toContain('root-B');
    });

    it('is a no-op for non-USER roles (no grant concept, already unrestricted)', async () => {
      const prisma = makePrisma([]);
      const ids = await getNavigableWarehouseIds(prisma, ADMIN);
      expect(ids.sort()).toEqual(
        ['root-A', 'child-A1', 'grandchild-A1a', 'root-B'].sort(),
      );
    });
  });

  describe('getWarehouseSubtreeIds', () => {
    it('stops descending into a branch whose includeInParentTotal is false', async () => {
      const excludedTree = [
        { id: 'root-A', parentId: null, includeInParentTotal: true },
        { id: 'child-A1', parentId: 'root-A', includeInParentTotal: false },
        {
          id: 'grandchild-A1a',
          parentId: 'child-A1',
          includeInParentTotal: true,
        },
      ];
      const prisma = {
        warehouse: {
          findUnique: jest.fn().mockResolvedValue({ ownerId: 'admin-1' }),
          findMany: jest.fn().mockResolvedValue(excludedTree),
        },
      } as any;

      const ids = await getWarehouseSubtreeIds(prisma, 'root-A', {
        onlyIncluded: true,
      });
      expect(ids).toEqual(['root-A']);
    });

    it('includes every descendant when onlyIncluded is not requested', async () => {
      const prisma = {
        warehouse: {
          findUnique: jest.fn().mockResolvedValue({ ownerId: 'admin-1' }),
          findMany: jest.fn().mockResolvedValue(TREE),
        },
      } as any;

      const ids = await getWarehouseSubtreeIds(prisma, 'root-A');
      expect(ids.sort()).toEqual(
        ['root-A', 'child-A1', 'grandchild-A1a'].sort(),
      );
    });
  });
});
