import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { MovementType } from '@repo/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { ProductsService } from './products.service';

const PLATFORM_ADMIN = { id: 'actor-1', role: 'PLATFORM_ADMIN' } as User;

function baseProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'target-1',
    name: 'Widget',
    description: null,
    unit: 'adet',
    categoryId: null,
    category: null,
    warehouseId: 'w1',
    warehouse: { id: 'w1', name: 'Depo 1' },
    criticalLevel: 10,
    leadTimeDays: 5,
    safetyMarginDays: 3,
    sortOrder: 0,
    ...overrides,
  };
}

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    warehouse: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let stockService: {
    recomputeSuggestion: jest.Mock;
    createMovement: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      warehouse: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') return arg(prisma);
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    auditLog = { log: jest.fn() };
    stockService = {
      recomputeSuggestion: jest.fn().mockResolvedValue(undefined),
      createMovement: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: StockService, useValue: stockService },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
  });

  describe('findAll with parentAggregateId', () => {
    it('excludes children with includeInParentTotal=false from the aggregate', async () => {
      const tree = [
        { id: 'parent-1', parentId: null, includeInParentTotal: true },
        {
          id: 'child-included',
          parentId: 'parent-1',
          includeInParentTotal: true,
        },
        {
          id: 'child-excluded',
          parentId: 'parent-1',
          includeInParentTotal: false,
        },
      ];
      prisma.warehouse.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.warehouse.findMany.mockResolvedValue(tree);

      await service.findAll({
        actor: PLATFORM_ADMIN,
        parentAggregateId: 'parent-1',
        page: 1,
        limit: 20,
      });

      const [{ where }] = prisma.product.findMany.mock.calls[0];
      expect(where.warehouseId.in.sort()).toEqual(
        ['child-included', 'parent-1'].sort(),
      );
      expect(where.warehouseId.in).not.toContain('child-excluded');
    });
  });

  describe('create', () => {
    it('rejects a product name that already exists in the target warehouse', async () => {
      prisma.product.findUnique.mockResolvedValue(baseProduct());

      await expect(
        service.create(
          {
            name: 'Widget',
            warehouseId: 'w1',
            criticalLevel: 10,
          } as any,
          PLATFORM_ADMIN,
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('cascades a field change to same-named products in sibling warehouses', async () => {
      prisma.product.findUnique.mockResolvedValue(baseProduct());
      prisma.warehouse.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.product.findMany.mockResolvedValue([
        { id: 'sibling-1', warehouseId: 'w2' },
      ]);

      await service.update(
        'target-1',
        { criticalLevel: 5, applyToAllWarehouses: true },
        PLATFORM_ADMIN,
      );

      expect(prisma.warehouse.findUnique).toHaveBeenCalledWith({
        where: { id: 'w1' },
        select: { ownerId: true },
      });
      // Hedef ürün + 1 kardeş ürün için update çağrılmalı, ikisi de aynı veriyle.
      const updateCalls = prisma.product.update.mock.calls;
      const expectedData = { criticalLevel: 5, criticalLevelManual: 5 };
      expect(updateCalls).toContainEqual([
        { where: { id: 'target-1' }, data: expectedData },
      ]);
      expect(updateCalls).toContainEqual([
        { where: { id: 'sibling-1' }, data: expectedData },
      ]);
    });

    it('does not cascade when applyToAllWarehouses is not set', async () => {
      prisma.product.findUnique.mockResolvedValue(baseProduct());

      await service.update('target-1', { criticalLevel: 5 }, PLATFORM_ADMIN);

      expect(prisma.warehouse.findUnique).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('duplicate', () => {
    it('adds stock to the existing product instead of erroring when the target warehouse already has it', async () => {
      const source = baseProduct({
        id: 'source-1',
        name: 'Widget',
        warehouseId: 'w1',
      });
      const existingInTarget = baseProduct({
        id: 'existing-1',
        name: 'Widget',
        warehouseId: 'w2',
        currentStock: 5,
      });

      prisma.product.findUnique
        .mockResolvedValueOnce(source) // findOne(source) içindeki kaynak ürün
        .mockResolvedValueOnce(existingInTarget) // hedef depoda isim çakışması kontrolü
        .mockResolvedValueOnce(existingInTarget); // dönüş için findOne(existing.id)

      const result = await service.duplicate(
        'source-1',
        { targetWarehouseId: 'w2', openingStock: 3 },
        PLATFORM_ADMIN,
      );

      expect(prisma.product.create).not.toHaveBeenCalled();
      expect(stockService.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'existing-1',
          type: MovementType.IN,
          quantity: 3,
        }),
        PLATFORM_ADMIN,
      );
      expect(result).toEqual(existingInTarget);
    });

    it('creates a new product when the target warehouse has no name conflict', async () => {
      const source = baseProduct({
        id: 'source-1',
        name: 'Widget',
        warehouseId: 'w1',
      });
      const created = baseProduct({
        id: 'new-1',
        name: 'Widget',
        warehouseId: 'w2',
      });

      prisma.product.findUnique
        .mockResolvedValueOnce(source) // findOne(source)
        .mockResolvedValueOnce(null) // hedef depoda çakışma yok
        .mockResolvedValueOnce(created); // dönüş için findOne(new-1)
      prisma.product.create.mockResolvedValue(created);

      await service.duplicate(
        'source-1',
        { targetWarehouseId: 'w2', openingStock: 3 },
        PLATFORM_ADMIN,
      );

      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      expect(stockService.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'new-1',
          type: MovementType.ADJUSTMENT,
          quantity: 3,
        }),
        PLATFORM_ADMIN,
      );
    });
  });
});
