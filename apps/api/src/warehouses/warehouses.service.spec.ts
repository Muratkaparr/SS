import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { WarehousesService } from './warehouses.service';

const ADMIN = { id: 'admin-1', role: 'ADMIN' } as User;
const USER = { id: 'user-1', role: 'USER', adminOwnerId: 'admin-1' } as User;

function baseWarehouse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    name: 'Depo',
    location: null,
    ownerId: 'admin-1',
    parentId: null as string | null,
    sortOrder: 0,
    includeInParentTotal: true,
    allChildrenLabel: 'Bütün Ürünler',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prisma: {
    warehouse: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    product: { findMany: jest.Mock; count: jest.Mock };
    user: { count: jest.Mock; update: jest.Mock };
    warehouseAccess: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { count: jest.fn().mockResolvedValue(0), update: jest.fn() },
      warehouseAccess: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    auditLog = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(WarehousesService);
  });

  describe('create', () => {
    it('rejects a duplicate name under the same parent', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'parent-1' }),
      );
      prisma.warehouse.findFirst.mockResolvedValueOnce(
        baseWarehouse({ name: 'Reyon 1', parentId: 'parent-1' }),
      );
      await expect(
        service.create({ name: 'Reyon 1', parentId: 'parent-1' } as any, ADMIN),
      ).rejects.toThrow(ConflictException);
      expect(prisma.warehouse.create).not.toHaveBeenCalled();
    });

    it('allows the same name to exist under two different parents', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'parent-2' }),
      );
      prisma.warehouse.findFirst.mockResolvedValue(null);
      prisma.warehouse.create.mockResolvedValue(
        baseWarehouse({ id: 'new-1', name: 'Reyon 1', parentId: 'parent-2' }),
      );
      const result = await service.create(
        { name: 'Reyon 1', parentId: 'parent-2' },
        ADMIN,
      );
      expect(result).toMatchObject({ id: 'new-1' });
    });

    it('rejects a parentId that belongs to a different owner', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'foreign-parent', ownerId: 'someone-else' }),
      );
      await expect(
        service.create(
          { name: 'Reyon 1', parentId: 'foreign-parent' } as any,
          ADMIN,
        ),
      ).rejects.toThrow();
      expect(prisma.warehouse.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks deleting the only remaining root (Ana Depo)', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'root-1', parentId: null }),
      );
      prisma.warehouse.count.mockResolvedValue(1);
      await expect(service.remove('root-1', ADMIN)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.warehouse.delete).not.toHaveBeenCalled();
    });

    it('allows deleting a child warehouse even when it is the only child', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'child-1', parentId: 'root-1' }),
      );
      const result = await service.remove('child-1', ADMIN);
      expect(result).toEqual({ success: true });
      expect(prisma.warehouse.delete).toHaveBeenCalledWith({
        where: { id: 'child-1' },
      });
      // Kök-seviye "en az bir depo kalmalı" sayacı çocuk silmede hiç tetiklenmemeli.
      expect(prisma.warehouse.count).not.toHaveBeenCalled();
    });
  });

  describe('update - reparenting (taşıma)', () => {
    it('rejects moving a warehouse into its own descendant (cycle)', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(
          baseWarehouse({ id: 'parent-1', parentId: null }),
        )
        .mockResolvedValueOnce(
          baseWarehouse({ id: 'child-1', parentId: 'parent-1' }),
        )
        .mockResolvedValueOnce({ ownerId: 'admin-1' });
      prisma.warehouse.findMany.mockResolvedValueOnce([
        { id: 'parent-1', parentId: null, includeInParentTotal: true },
        { id: 'child-1', parentId: 'parent-1', includeInParentTotal: true },
      ]);

      await expect(
        service.update('parent-1', { parentId: 'child-1' } as any, ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.warehouse.update).not.toHaveBeenCalled();
    });

    it('blocks moving the last remaining root into a child position', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(baseWarehouse({ id: 'root-1', parentId: null }))
        .mockResolvedValueOnce(
          baseWarehouse({ id: 'other-root', parentId: null }),
        )
        .mockResolvedValueOnce({ ownerId: 'admin-1' });
      prisma.warehouse.findMany.mockResolvedValueOnce([
        { id: 'root-1', parentId: null, includeInParentTotal: true },
        { id: 'other-root', parentId: null, includeInParentTotal: true },
      ]);
      prisma.warehouse.count.mockResolvedValueOnce(1);

      await expect(
        service.update('root-1', { parentId: 'other-root' } as any, ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.warehouse.update).not.toHaveBeenCalled();
    });

    it('rejects moving into a warehouse owned by a different admin', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(baseWarehouse({ id: 'w1', parentId: null }))
        .mockResolvedValueOnce(
          baseWarehouse({ id: 'foreign', ownerId: 'someone-else' }),
        );

      await expect(
        service.update('w1', { parentId: 'foreign' } as any, ADMIN),
      ).rejects.toThrow();
      expect(prisma.warehouse.update).not.toHaveBeenCalled();
    });

    it('moves a warehouse under a new parent when there is no conflict', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(
          baseWarehouse({ id: 'w1', parentId: null, name: 'Depo' }),
        )
        .mockResolvedValueOnce(
          baseWarehouse({ id: 'target-parent', parentId: null }),
        )
        .mockResolvedValueOnce({ ownerId: 'admin-1' });
      prisma.warehouse.findMany.mockResolvedValueOnce([
        { id: 'w1', parentId: null, includeInParentTotal: true },
        { id: 'target-parent', parentId: null, includeInParentTotal: true },
      ]);
      prisma.warehouse.count.mockResolvedValueOnce(2);
      prisma.warehouse.findFirst.mockResolvedValueOnce(null);
      prisma.warehouse.update.mockResolvedValueOnce(
        baseWarehouse({ id: 'w1', parentId: 'target-parent', name: 'Depo' }),
      );

      await service.update('w1', { parentId: 'target-parent' }, ADMIN);

      expect(prisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: { parentId: 'target-parent' },
        include: { owner: { select: { id: true, name: true } } },
      });
    });
  });

  describe('findOne', () => {
    it('rejects a USER reading a warehouse outside their granted subtree (IDOR regression)', async () => {
      // USER sadece 'w2'ye izinli; 'w1' aynı Admin'in havuzunda ama ayrı bir kök depo.
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'w1', ownerId: 'admin-1' }),
      );
      prisma.warehouse.findMany.mockResolvedValue([
        { id: 'w1', parentId: null, includeInParentTotal: true },
        { id: 'w2', parentId: null, includeInParentTotal: true },
      ]);
      prisma.warehouseAccess.findMany.mockResolvedValue([
        { warehouseId: 'w2' },
      ]);

      await expect(service.findOne('w1', USER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows a USER to read a warehouse within their granted subtree', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'w2', ownerId: 'admin-1' }),
      );
      prisma.warehouse.findMany.mockResolvedValue([
        { id: 'w1', parentId: null, includeInParentTotal: true },
        { id: 'w2', parentId: null, includeInParentTotal: true },
      ]);
      prisma.warehouseAccess.findMany.mockResolvedValue([
        { warehouseId: 'w2' },
      ]);

      const result = await service.findOne('w2', USER);
      expect(result).toMatchObject({ id: 'w2' });
    });

    it('allows a USER with no explicit grants to read any warehouse in their pool (legacy default)', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'w1', ownerId: 'admin-1' }),
      );
      prisma.warehouse.findMany.mockResolvedValue([
        { id: 'w1', parentId: null, includeInParentTotal: true },
      ]);
      prisma.warehouseAccess.findMany.mockResolvedValue([]);

      const result = await service.findOne('w1', USER);
      expect(result).toMatchObject({ id: 'w1' });
    });

    it('rejects an ADMIN reading a warehouse owned by a different admin', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'foreign', ownerId: 'someone-else' }),
      );
      await expect(service.findOne('foreign', ADMIN)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('counts the whole descendant subtree (not just direct children) for deletion-impact stats', async () => {
      // root-1 > child-1 > grandchild-1 — silme onayının derin ağaçta gerçek etkiyi
      // göstermesi için childCount (direkt) değil, alt ağacın TAMAMI sayılmalı.
      prisma.warehouse.findUnique.mockResolvedValue(
        baseWarehouse({ id: 'root-1', ownerId: 'admin-1' }),
      );
      prisma.warehouse.findMany.mockResolvedValue([
        { id: 'root-1', parentId: null, includeInParentTotal: true },
        { id: 'child-1', parentId: 'root-1', includeInParentTotal: true },
        {
          id: 'grandchild-1',
          parentId: 'child-1',
          includeInParentTotal: true,
        },
      ]);
      // childCount (direkt çocuk) hesaplaması için ayrı bir count çağrısı.
      prisma.warehouse.count.mockResolvedValueOnce(1);
      prisma.product.count.mockResolvedValueOnce(5);

      const result = await service.findOne('root-1', ADMIN);
      expect(result).toMatchObject({
        childCount: 1,
        totalDescendantWarehouseCount: 2,
        totalProductCount: 5,
      });
    });
  });

  describe('reorder', () => {
    it('rejects mixing warehouses that have different parents', async () => {
      prisma.warehouse.findMany.mockResolvedValue([
        baseWarehouse({ id: 'a', parentId: 'p1' }),
        baseWarehouse({ id: 'b', parentId: 'p2' }),
      ]);
      await expect(
        service.reorder({ ids: ['a', 'b'] } as any, ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows reordering siblings under the same parent', async () => {
      prisma.warehouse.findMany.mockResolvedValue([
        baseWarehouse({ id: 'a', parentId: 'p1' }),
        baseWarehouse({ id: 'b', parentId: 'p1' }),
      ]);
      await service.reorder({ ids: ['b', 'a'] }, ADMIN);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
