import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User, Warehouse } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ownerScopeFor } from '../common/utils/warehouse-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ReorderWarehousesDto } from './dto/reorder-warehouses.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(actor: User) {
    const warehouses = await this.prisma.warehouse.findMany({
      where:
        actor.role === 'PLATFORM_ADMIN'
          ? {}
          : { ownerId: ownerScopeFor(actor) ?? '' },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return Promise.all(warehouses.map((w) => this.withStats(w)));
  }

  /** Depo sekmelerini admin'in istediği sırayla dizer (sürükle-bırak). */
  async reorder(dto: ReorderWarehousesDto, actor: User) {
    const uniqueIds = Array.from(new Set(dto.ids));
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: uniqueIds } },
    });
    if (warehouses.length !== uniqueIds.length) {
      throw new NotFoundException('Bazı depolar bulunamadı');
    }
    for (const warehouse of warehouses) {
      this.assertOwnership(warehouse, actor);
    }

    await this.prisma.$transaction(
      uniqueIds.map((id, index) =>
        this.prisma.warehouse.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.auditLog.log({
      userId: actor.id,
      action: 'REORDER',
      resource: 'WAREHOUSE',
      meta: { ids: uniqueIds },
    });

    return { success: true };
  }

  async findOne(id: string, actor: User) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { owner: { select: { id: true, name: true } } },
    });
    if (!warehouse) throw new NotFoundException('Depo bulunamadı');
    this.assertOwnership(warehouse, actor);
    return this.withStats(warehouse);
  }

  async create(dto: CreateWarehouseDto, actor: User) {
    let ownerId: string;
    if (actor.role === 'PLATFORM_ADMIN') {
      if (!dto.ownerId) {
        throw new BadRequestException(
          "Depo hangi Admin'e ait olacak (ownerId) belirtilmeli",
        );
      }
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
      });
      if (!owner || owner.role !== 'ADMIN') {
        throw new NotFoundException('Belirtilen Admin bulunamadı');
      }
      ownerId = owner.id;
    } else {
      ownerId = actor.id;
    }

    const existing = await this.prisma.warehouse.findUnique({
      where: { ownerId_name: { ownerId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('Bu isimde bir deponuz zaten var');
    }

    const last = await this.prisma.warehouse.findFirst({
      where: { ownerId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const warehouse = await this.prisma.warehouse.create({
      data: {
        name: dto.name,
        location: dto.location,
        ownerId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'CREATE',
      resource: 'WAREHOUSE',
      resourceId: warehouse.id,
      meta: { name: warehouse.name },
    });
    return this.withStats(warehouse);
  }

  async update(id: string, dto: UpdateWarehouseDto, actor: User) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Depo bulunamadı');
    this.assertOwnership(warehouse, actor);

    if (dto.name && dto.name !== warehouse.name) {
      const existing = await this.prisma.warehouse.findUnique({
        where: { ownerId_name: { ownerId: warehouse.ownerId, name: dto.name } },
      });
      if (existing)
        throw new ConflictException('Bu isimde bir deponuz zaten var');
    }

    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'UPDATE',
      resource: 'WAREHOUSE',
      resourceId: id,
      meta: { changes: Object.keys(dto) },
    });
    return this.withStats(updated);
  }

  async remove(id: string, actor: User) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Depo bulunamadı');
    this.assertOwnership(warehouse, actor);

    const ownerWarehouseCount = await this.prisma.warehouse.count({
      where: { ownerId: warehouse.ownerId },
    });
    if (ownerWarehouseCount <= 1) {
      throw new BadRequestException('En az bir depo kalmalı');
    }

    await this.prisma.warehouse.delete({ where: { id } });
    await this.auditLog.log({
      userId: actor.id,
      action: 'DELETE',
      resource: 'WAREHOUSE',
      resourceId: id,
      meta: { name: warehouse.name },
    });
    return { success: true };
  }

  private assertOwnership(warehouse: Warehouse, actor: User) {
    if (actor.role === 'PLATFORM_ADMIN') return;
    const ownerId = ownerScopeFor(actor);
    if (!ownerId || warehouse.ownerId !== ownerId) {
      throw new ForbiddenException('Bu depoya erişiminiz yok');
    }
  }

  private async withStats(
    warehouse: Warehouse & { owner?: { id: string; name: string } },
  ) {
    const [products, userCount] = await Promise.all([
      this.prisma.product.findMany({
        where: { warehouseId: warehouse.id },
        select: { currentStock: true, criticalLevel: true },
      }),
      this.prisma.user.count({
        where: {
          isActive: true,
          OR: [{ id: warehouse.ownerId }, { adminOwnerId: warehouse.ownerId }],
        },
      }),
    ]);

    const criticalCount = products.filter(
      (p) => p.criticalLevel > 0 && p.currentStock <= p.criticalLevel,
    ).length;

    return {
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location,
      ownerId: warehouse.ownerId,
      ownerName: warehouse.owner?.name ?? null,
      createdAt: warehouse.createdAt,
      productCount: products.length,
      criticalCount,
      userCount,
    };
  }
}
