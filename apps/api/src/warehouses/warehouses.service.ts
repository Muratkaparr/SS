import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User, Warehouse } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  getNavigableWarehouseIds,
  getWarehouseSubtreeIds,
  ownerScopeFor,
} from '../common/utils/warehouse-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ReorderWarehousesDto } from './dto/reorder-warehouses.dto';
import { UpdateRootLabelDto } from './dto/update-root-label.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * `parentId` verilmezse geriye dönük uyumlu davranış: sahibin TÜM depo ağacı düz
   * liste olarak döner (developer paneli ve depo yetkisi seçim ağacı bunu kullanır).
   * `'root'` sadece ana depoları, bir id ise o deponun direkt çocuklarını döner.
   * `ownerId` sadece Platform Admin için anlamlıdır: belirli bir Admin'in havuzuyla
   * sınırlar (örn. bir USER'a depo yetkisi atarken).
   */
  async findAll(actor: User, parentId?: string, ownerId?: string) {
    const baseWhere: Prisma.WarehouseWhereInput =
      actor.role === 'PLATFORM_ADMIN'
        ? ownerId
          ? { ownerId }
          : {}
        : actor.role === 'USER'
          ? { id: { in: await getNavigableWarehouseIds(this.prisma, actor) } }
          : { ownerId: ownerScopeFor(actor) ?? '' };

    const where: Prisma.WarehouseWhereInput =
      parentId === undefined
        ? baseWhere
        : { ...baseWhere, parentId: parentId === 'root' ? null : parentId };

    const warehouses = await this.prisma.warehouse.findMany({
      where,
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

    const distinctParents = new Set(warehouses.map((w) => w.parentId ?? ''));
    if (distinctParents.size > 1) {
      throw new BadRequestException(
        'Sadece aynı üst depo altındaki depolar birlikte sıralanabilir',
      );
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
    await this.assertViewable(warehouse, actor);
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

    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.warehouse.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.ownerId !== ownerId) {
        throw new NotFoundException('Belirtilen üst depo bulunamadı');
      }
      parentId = parent.id;
    }

    const existing = await this.prisma.warehouse.findFirst({
      where: { ownerId, parentId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Bu isimde bir deponuz zaten var');
    }

    const last = await this.prisma.warehouse.findFirst({
      where: { ownerId, parentId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const warehouse = await this.prisma.warehouse.create({
      data: {
        name: dto.name,
        location: dto.location,
        ownerId,
        parentId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'CREATE',
      resource: 'WAREHOUSE',
      resourceId: warehouse.id,
      meta: { name: warehouse.name, parentId },
    });
    return this.withStats(warehouse);
  }

  async update(id: string, dto: UpdateWarehouseDto, actor: User) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Depo bulunamadı');
    this.assertOwnership(warehouse, actor);

    // Depo, mevcut verisi silinmeden başka bir üst deponun altına taşınabilir (veya
    // `parentId: null` ile bağımsız bir Ana Depo'ya dönüştürülebilir).
    const parentChanging =
      dto.parentId !== undefined && dto.parentId !== warehouse.parentId;
    const nextParentId = parentChanging ? dto.parentId! : warehouse.parentId;

    if (parentChanging) {
      if (nextParentId === warehouse.id) {
        throw new BadRequestException('Bir depo kendi altına taşınamaz');
      }

      if (nextParentId !== null) {
        const newParent = await this.prisma.warehouse.findUnique({
          where: { id: nextParentId },
        });
        if (!newParent || newParent.ownerId !== warehouse.ownerId) {
          throw new NotFoundException('Hedef üst depo bulunamadı');
        }
        const descendantIds = await getWarehouseSubtreeIds(
          this.prisma,
          warehouse.id,
        );
        if (descendantIds.includes(nextParentId)) {
          throw new BadRequestException(
            'Bir depo, kendi alt ağacındaki bir depoya taşınamaz',
          );
        }
      }

      // Bir Ana Depo alt depo yapılıyorsa, sahibin en az bir Ana Depo'su kalmalı.
      if (warehouse.parentId === null) {
        const rootCount = await this.prisma.warehouse.count({
          where: { ownerId: warehouse.ownerId, parentId: null },
        });
        if (rootCount <= 1) {
          throw new BadRequestException('En az bir ana depo kalmalı');
        }
      }
    }

    const nextName = dto.name ?? warehouse.name;
    const nameChanging = dto.name !== undefined && dto.name !== warehouse.name;
    if (nameChanging || parentChanging) {
      const conflict = await this.prisma.warehouse.findFirst({
        where: {
          ownerId: warehouse.ownerId,
          parentId: nextParentId,
          name: nextName,
          id: { not: warehouse.id },
        },
      });
      if (conflict)
        throw new ConflictException('Bu isimde bir deponuz zaten var');
    }

    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.includeInParentTotal !== undefined
          ? { includeInParentTotal: dto.includeInParentTotal }
          : {}),
        ...(dto.allChildrenLabel !== undefined
          ? { allChildrenLabel: dto.allChildrenLabel }
          : {}),
        ...(parentChanging ? { parentId: nextParentId } : {}),
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

  /** Kök seviye "Bütün Ürünler" sekmesinin bu Admin için özelleştirilmiş adını günceller. */
  async updateRootLabel(actor: User, dto: UpdateRootLabelDto) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Bu ayarı sadece Admin değiştirebilir');
    }
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { rootAllWarehousesLabel: dto.label },
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'UPDATE',
      resource: 'USER_SETTINGS',
      meta: { rootAllWarehousesLabel: dto.label },
    });
    return { rootAllWarehousesLabel: dto.label };
  }

  async remove(id: string, actor: User) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Depo bulunamadı');
    this.assertOwnership(warehouse, actor);

    // "En az bir depo kalmalı" kısıtı sadece kök (Ana Depo) seviyesinde uygulanır —
    // bir ana deponun tüm alt depolarını silmek serbesttir.
    if (warehouse.parentId === null) {
      const rootCount = await this.prisma.warehouse.count({
        where: { ownerId: warehouse.ownerId, parentId: null },
      });
      if (rootCount <= 1) {
        throw new BadRequestException('En az bir ana depo kalmalı');
      }
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

  /**
   * `assertOwnership`'in üzerine, USER rolü için ayrıca `WarehouseAccess` kısıtını
   * da uygular (gezinme/breadcrumb amaçlı — atalar dahil, bkz. getNavigableWarehouseIds).
   * `findOne` tek depo detayında meta veri (isim, sayaçlar) sızdırmaması için gerekli;
   * findAll zaten bu kontrolü kendi sorgusunda uyguluyor.
   */
  private async assertViewable(warehouse: Warehouse, actor: User) {
    this.assertOwnership(warehouse, actor);
    if (actor.role === 'USER') {
      const navigableIds = await getNavigableWarehouseIds(this.prisma, actor);
      if (!navigableIds.includes(warehouse.id)) {
        throw new ForbiddenException('Bu depoya erişiminiz yok');
      }
    }
  }

  private async withStats(
    warehouse: Warehouse & { owner?: { id: string; name: string } },
  ) {
    // Silme onayında gösterilecek gerçek etki için tüm alt ağaç (torunlar
    // dahil) gerekiyor — `childCount` kasıtlı olarak sadece DİREKT çocukları
    // sayar (sidebar/navigasyon "yaprak mı" sorusuna cevap verir), bu yüzden
    // ayrı bir alan olarak hesaplanır.
    const subtreeIds = await getWarehouseSubtreeIds(this.prisma, warehouse.id);

    const [products, userCount, childCount, totalProductCount] =
      await Promise.all([
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
        this.prisma.warehouse.count({ where: { parentId: warehouse.id } }),
        this.prisma.product.count({
          where: { warehouseId: { in: subtreeIds } },
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
      parentId: warehouse.parentId,
      includeInParentTotal: warehouse.includeInParentTotal,
      allChildrenLabel: warehouse.allChildrenLabel,
      childCount,
      totalDescendantWarehouseCount: subtreeIds.length - 1,
      totalProductCount,
      createdAt: warehouse.createdAt,
      productCount: products.length,
      criticalCount,
      userCount,
    };
  }
}
