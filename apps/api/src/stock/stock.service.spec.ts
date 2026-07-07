import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { MovementType } from '@repo/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from './stock.service';

const PLATFORM_ADMIN = { id: 'actor-1', role: 'PLATFORM_ADMIN' } as User;

describe('StockService', () => {
  let service: StockService;
  let prisma: {
    product: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    stockMovement: {
      create: jest.Mock;
      aggregate: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: 'movement-1' }),
        // Varsayılan: tüketim geçmişi yok — recomputeSuggestion'ı zararsız hale getirir.
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    auditLog = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(StockService);
  });

  describe('createMovement', () => {
    it('rejects an OUT movement that would take stock negative', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        warehouseId: 'w1',
        currentStock: 5,
      });

      await expect(
        service.createMovement(
          { productId: 'p1', type: MovementType.OUT, quantity: 10 },
          PLATFORM_ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an IN/OUT movement with quantity 0', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        warehouseId: 'w1',
        currentStock: 5,
      });

      await expect(
        service.createMovement(
          { productId: 'p1', type: MovementType.IN, quantity: 0 },
          PLATFORM_ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ADJUSTMENT sets the absolute stock count rather than adding to it', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        warehouseId: 'w1',
        currentStock: 20,
      });

      await service.createMovement(
        { productId: 'p1', type: MovementType.ADJUSTMENT, quantity: 8 },
        PLATFORM_ADMIN,
      );

      // İlk product.update çağrısı transaction içindeki stok güncellemesi.
      const [stockUpdateCall] = prisma.product.update.mock.calls;
      expect(stockUpdateCall[0]).toEqual({
        where: { id: 'p1' },
        data: { currentStock: 8 },
      });

      // Ledger'a yazılan miktar delta'nın (20 -> 8 = -12) mutlak değeri olmalı, girilen 8 değil.
      const [createCall] = prisma.stockMovement.create.mock.calls;
      expect(createCall[0].data.quantity).toBe(12);
    });

    it('IN/OUT movements still record the plain delta as quantity', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        warehouseId: 'w1',
        currentStock: 10,
      });

      await service.createMovement(
        { productId: 'p1', type: MovementType.IN, quantity: 4 },
        PLATFORM_ADMIN,
      );

      const [stockUpdateCall] = prisma.product.update.mock.calls;
      expect(stockUpdateCall[0]).toEqual({
        where: { id: 'p1' },
        data: { currentStock: 14 },
      });
      const [createCall] = prisma.stockMovement.create.mock.calls;
      expect(createCall[0].data.quantity).toBe(4);
    });
  });

  describe('recomputeSuggestion', () => {
    it('computes ADC/suggestion/confidence from movement history', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        leadTimeDays: 5,
        safetyMarginDays: 3,
      });
      // Çağrı sırası: [outLast7d, outLast30d, priorWeekOut] (Promise.all sırası korunur).
      prisma.stockMovement.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 70 } }) // son 7 gün
        .mockResolvedValueOnce({ _sum: { quantity: 300 } }) // son 30 gün
        .mockResolvedValueOnce({ _sum: { quantity: 70 } }); // önceki hafta (trend sıfır)
      prisma.stockMovement.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      });

      await service.recomputeSuggestion('p1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          avgDailyConsumption7d: 10,
          avgDailyConsumption30d: 10,
          suggestedCriticalLevel: 80,
          confidence: 'HIGH',
        },
      });
    });
  });
});
