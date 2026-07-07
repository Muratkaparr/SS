import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import type { User } from '@prisma/client';
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
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    warehouse: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let stockService: { recomputeSuggestion: jest.Mock; createMovement: jest.Mock };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      warehouse: { findUnique: jest.fn() },
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
        { criticalLevel: 5, applyToAllWarehouses: true } as any,
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

      await service.update(
        'target-1',
        { criticalLevel: 5 } as any,
        PLATFORM_ADMIN,
      );

      expect(prisma.warehouse.findUnique).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledTimes(1);
    });
  });
});
