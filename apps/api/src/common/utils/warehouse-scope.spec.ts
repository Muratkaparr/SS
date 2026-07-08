import type { User } from '@prisma/client';
import {
  getAccessibleWarehouseIds,
  getNavigableWarehouseIds,
  getWarehouseSubtreeIds,
} from './warehouse-scope';

const USER = {
  id: 'user-1',
  role: 'USER',
  adminOwnerId: 'admin-1',
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
