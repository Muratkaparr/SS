import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Order, User } from '@prisma/client';
import { MovementType, OrderStatus } from '@repo/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  assertWarehouseAccess,
  getAccessibleWarehouseIds,
} from '../common/utils/warehouse-scope';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DecideOrderDto } from './dto/decide-order.dto';

const INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      unit: true,
      warehouseId: true,
      currentStock: true,
    },
  },
  requestedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  suppliedBy: { select: { id: true, name: true } },
} as const;

/** Tedarikçi depo sahipliğine bağlı değildir — sadece onaylanmış/tedarik edilmiş siparişleri, tüm depolar genelinde görür. */
const SUPPLIER_VISIBLE_STATUSES = [OrderStatus.APPROVED, OrderStatus.FULFILLED];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly stockService: StockService,
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

  /** Aktörün bu siparişi görme/üzerinde işlem yapma yetkisi var mı — kendi siparişi ya da ürünün deposuna erişimi varsa. */
  private async assertOrderAccess(order: Order, actor: User) {
    if (actor.role === 'PLATFORM_ADMIN' || actor.role === 'SUPPLIER') return;
    if (order.requestedById === actor.id) return;
    if (actor.role === 'USER') {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    await this.getOwnedProduct(order.productId, actor);
  }

  async create(dto: CreateOrderDto, actor: User) {
    await this.getOwnedProduct(dto.productId, actor);

    const order = await this.prisma.order.create({
      data: {
        productId: dto.productId,
        quantity: dto.quantity,
        note: dto.note,
        requestedById: actor.id,
      },
      include: INCLUDE,
    });

    await this.auditLog.log({
      userId: actor.id,
      action: 'CREATE',
      resource: 'ORDER',
      resourceId: order.id,
      meta: { productId: dto.productId, quantity: dto.quantity },
    });

    return order;
  }

  async list(params: {
    actor: User;
    status?: OrderStatus;
    warehouseId?: string;
    page: number;
    limit: number;
  }) {
    const { actor, status, page, limit } = params;

    if (actor.role === 'SUPPLIER') {
      const where = {
        status:
          status && SUPPLIER_VISIBLE_STATUSES.includes(status)
            ? status
            : { in: SUPPLIER_VISIBLE_STATUSES },
      };
      const [items, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: INCLUDE,
        }),
        this.prisma.order.count({ where }),
      ]);
      return { items, total, page, limit };
    }

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
      ...(status ? { status } : {}),
      // USER sadece kendi taleplerini görür; ADMIN/PLATFORM_ADMIN depo havuzundaki tüm talepleri görür.
      ...(actor.role === 'USER' ? { requestedById: actor.id } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  private async getOrderInStatus(id: string, actor: User, allowed: string[]) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    await this.assertOrderAccess(order, actor);
    if (!allowed.includes(order.status)) {
      throw new BadRequestException(
        'Bu işlem için sipariş uygun durumda değil',
      );
    }
    return order;
  }

  /** Admin talebi onaylar — stok henüz düşmez, sipariş tedarikçinin kuyruğuna düşer. */
  async approve(id: string, dto: DecideOrderDto, actor: User) {
    const order = await this.getOrderInStatus(id, actor, [OrderStatus.PENDING]);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.APPROVED,
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: dto.note,
      },
      include: INCLUDE,
    });

    await this.auditLog.log({
      userId: actor.id,
      action: 'APPROVE',
      resource: 'ORDER',
      resourceId: id,
      meta: { productId: order.productId, quantity: order.quantity },
    });

    return updated;
  }

  async reject(id: string, dto: DecideOrderDto, actor: User) {
    const order = await this.getOrderInStatus(id, actor, [OrderStatus.PENDING]);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.REJECTED,
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: dto.note,
      },
      include: INCLUDE,
    });

    await this.auditLog.log({
      userId: actor.id,
      action: 'REJECT',
      resource: 'ORDER',
      resourceId: id,
      meta: { productId: order.productId },
    });

    return updated;
  }

  /** Tedarikçi fiili tedarik edildiğini onaylar — stok burada düşer ve sipariş kapanır. */
  async supply(id: string, dto: DecideOrderDto, actor: User) {
    const order = await this.getOrderInStatus(id, actor, [
      OrderStatus.APPROVED,
    ]);

    // Stok düşümü mevcut stok hareketi akışından geçer — eşzamanlılık koruması
    // (overselling) ve tüketim/kritik seviye yeniden hesaplaması oradan gelir.
    await this.stockService.createMovement(
      {
        productId: order.productId,
        type: MovementType.OUT,
        quantity: order.quantity,
        reason: `Sipariş tedarik edildi${dto.note ? ` — ${dto.note}` : ''}`,
      },
      actor,
    );

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.FULFILLED,
        suppliedById: actor.id,
        suppliedAt: new Date(),
        supplyNote: dto.note,
      },
      include: INCLUDE,
    });

    await this.auditLog.log({
      userId: actor.id,
      action: 'SUPPLY',
      resource: 'ORDER',
      resourceId: id,
      meta: { productId: order.productId, quantity: order.quantity },
    });

    return updated;
  }

  async cancel(id: string, actor: User) {
    const order = await this.getOrderInStatus(id, actor, [
      OrderStatus.PENDING,
      OrderStatus.APPROVED,
    ]);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        decidedById: actor.id,
        decidedAt: new Date(),
      },
      include: INCLUDE,
    });

    await this.auditLog.log({
      userId: actor.id,
      action: 'CANCEL',
      resource: 'ORDER',
      resourceId: id,
      meta: { productId: order.productId },
    });

    return updated;
  }
}
