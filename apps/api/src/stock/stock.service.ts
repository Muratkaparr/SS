import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { User } from '@prisma/client';
import { MovementType } from '@repo/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  assertWarehouseAccess,
  getAccessibleWarehouseIds,
} from '../common/utils/warehouse-scope';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateConfidence,
  calculateSuggestedCriticalLevel,
} from './critical-level.util';
import { CreateMovementDto } from './dto/create-movement.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async getOwnedProduct(productId: string, actor: User) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }
    if (actor.role !== 'PLATFORM_ADMIN') {
      const accessible = await getAccessibleWarehouseIds(this.prisma, actor);
      if (!accessible.includes(product.warehouseId)) {
        throw new NotFoundException('Ürün bulunamadı');
      }
    }
    return product;
  }

  async createMovement(dto: CreateMovementDto, actor: User) {
    if (actor.role === 'USER' && dto.type === MovementType.ADJUSTMENT) {
      throw new ForbiddenException(
        'Kullanıcılar sadece stok girişi/çıkışı yapabilir, sayım düzeltmesi admin yetkisi gerektirir',
      );
    }

    const product = await this.getOwnedProduct(dto.productId, actor);

    const delta = dto.type === MovementType.OUT ? -dto.quantity : dto.quantity;
    const nextStock = product.currentStock + delta;
    if (nextStock < 0) {
      throw new BadRequestException(
        `Yetersiz stok: mevcut ${product.currentStock}, çıkarılmak istenen ${dto.quantity}`,
      );
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          userId: actor.id,
        },
      });
      await tx.product.update({
        where: { id: dto.productId },
        data: { currentStock: nextStock },
      });
      return created;
    });

    await this.auditLog.log({
      userId: actor.id,
      action: 'CREATE',
      resource: 'STOCK_MOVEMENT',
      resourceId: movement.id,
      meta: {
        productId: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
      },
    });

    await this.recomputeSuggestion(dto.productId);

    return movement;
  }

  async listMovements(params: {
    actor: User;
    warehouseId?: string;
    productId?: string;
    page: number;
    limit: number;
  }) {
    const { actor, productId, page, limit } = params;
    const warehouseFilter = params.warehouseId
      ? {
          warehouseId: await assertWarehouseAccess(
            this.prisma,
            actor,
            params.warehouseId,
          ),
        }
      : {
          warehouseId: {
            in: await getAccessibleWarehouseIds(this.prisma, actor),
          },
        };

    const where = {
      product: warehouseFilter,
      ...(productId ? { productId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, unit: true } },
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getAlerts(actor: User, requestedWarehouseId?: string) {
    const warehouseFilter = requestedWarehouseId
      ? {
          warehouseId: await assertWarehouseAccess(
            this.prisma,
            actor,
            requestedWarehouseId,
          ),
        }
      : {
          warehouseId: {
            in: await getAccessibleWarehouseIds(this.prisma, actor),
          },
        };

    const products = await this.prisma.product.findMany({
      where: { ...warehouseFilter, criticalLevel: { gt: 0 } },
      include: { category: { select: { name: true } } },
      orderBy: { currentStock: 'asc' },
    });
    return products
      .filter((p) => p.currentStock <= p.criticalLevel)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        category: p.category?.name ?? null,
        currentStock: p.currentStock,
        criticalLevel: p.criticalLevel,
        avgDailyConsumption7d: p.avgDailyConsumption7d,
        daysUntilStockout:
          p.avgDailyConsumption7d > 0
            ? Math.floor(p.currentStock / p.avgDailyConsumption7d)
            : null,
        severity: p.currentStock <= 0 ? 'OUT_OF_STOCK' : 'CRITICAL',
      }));
  }

  async getTrend(productId: string, days: number, actor: User) {
    await this.getOwnedProduct(productId, actor);

    const since = new Date(Date.now() - days * DAY_MS);
    const movements = await this.prisma.stockMovement.findMany({
      where: { productId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const byDay = new Map<string, { in: number; out: number }>();
    for (const m of movements) {
      const key = m.createdAt.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { in: 0, out: 0 };
      if (m.type === 'OUT') entry.out += m.quantity;
      else entry.in += m.quantity;
      byDay.set(key, entry);
    }

    const result: { date: string; in: number; out: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
      const entry = byDay.get(date) ?? { in: 0, out: 0 };
      result.push({ date, ...entry });
    }
    return result;
  }

  async getSummary(actor: User, requestedWarehouseId?: string) {
    const warehouseFilter = requestedWarehouseId
      ? {
          warehouseId: await assertWarehouseAccess(
            this.prisma,
            actor,
            requestedWarehouseId,
          ),
        }
      : {
          warehouseId: {
            in: await getAccessibleWarehouseIds(this.prisma, actor),
          },
        };

    const [totalProducts, products, movementsToday] = await Promise.all([
      this.prisma.product.count({ where: warehouseFilter }),
      this.prisma.product.findMany({
        where: warehouseFilter,
        select: { currentStock: true, criticalLevel: true },
      }),
      this.prisma.stockMovement.count({
        where: {
          product: warehouseFilter,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    const criticalCount = products.filter(
      (p) => p.criticalLevel > 0 && p.currentStock > 0 && p.currentStock <= p.criticalLevel,
    ).length;
    const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;
    return { totalProducts, criticalCount, outOfStockCount, movementsToday };
  }

  async applySuggestion(productId: string, actor: User) {
    const product = await this.getOwnedProduct(productId, actor);
    if (product.suggestedCriticalLevel == null) {
      throw new BadRequestException('Henüz bir öneri hesaplanmadı');
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        criticalLevel: product.suggestedCriticalLevel,
        criticalLevelManual: product.suggestedCriticalLevel,
      },
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'APPLY_SUGGESTION',
      resource: 'PRODUCT',
      resourceId: productId,
      meta: { criticalLevel: updated.criticalLevel },
    });
    return updated;
  }

  async recomputeSuggestion(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return;

    const now = Date.now();
    const [outLast7d, outLast30d, priorWeekOut, firstMovement] =
      await Promise.all([
        this.sumOut(productId, new Date(now - 7 * DAY_MS)),
        this.sumOut(productId, new Date(now - 30 * DAY_MS)),
        this.sumOut(
          productId,
          new Date(now - 14 * DAY_MS),
          new Date(now - 7 * DAY_MS),
        ),
        this.prisma.stockMovement.findFirst({
          where: { productId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const weeklyTrendSlope = outLast7d / 7 - priorWeekOut / 7;

    const {
      avgDailyConsumption7d,
      avgDailyConsumption30d,
      suggestedCriticalLevel,
    } = calculateSuggestedCriticalLevel({
      outLast7d,
      outLast30d,
      leadTimeDays: product.leadTimeDays,
      safetyMarginDays: product.safetyMarginDays,
      weeklyTrendSlope,
    });

    const daysOfHistory = firstMovement
      ? Math.floor((now - firstMovement.createdAt.getTime()) / DAY_MS)
      : 0;
    const confidence = calculateConfidence(daysOfHistory);

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        avgDailyConsumption7d,
        avgDailyConsumption30d,
        suggestedCriticalLevel,
        confidence,
      },
    });
  }

  private async sumOut(productId: string, since: Date, until?: Date) {
    const result = await this.prisma.stockMovement.aggregate({
      where: {
        productId,
        type: MovementType.OUT,
        createdAt: { gte: since, ...(until ? { lt: until } : {}) },
      },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async recomputeAllSuggestions() {
    const products = await this.prisma.product.findMany({
      select: { id: true },
    });
    for (const p of products) {
      await this.recomputeSuggestion(p.id);
    }
  }
}
