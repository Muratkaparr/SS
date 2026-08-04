import { unlink } from 'fs/promises';
import { join } from 'path';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { MovementType } from '@repo/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  assertWarehouseAccess,
  getAccessibleWarehouseIds,
  getRootAggregateWarehouseIds,
  getWarehouseSubtreeIds,
  ownerScopeFor,
} from '../common/utils/warehouse-scope';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { DuplicateProductDto } from './dto/duplicate-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/** imageUrl "/uploads/products/xxx.png" formatında saklanır — diskteki karşılığını siler. */
async function deleteImageFile(imageUrl: string | null | undefined) {
  if (!imageUrl) return;
  const relative = imageUrl.replace(/^\/uploads\//, '');
  const absolute = join(__dirname, '..', '..', 'uploads', relative);
  try {
    await unlink(absolute);
  } catch {
    // Dosya zaten yoksa veya silinemiyorsa sessizce geç — kritik bir işlem değil.
  }
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly stockService: StockService,
  ) {}

  async findAll(params: {
    actor: User;
    warehouseId?: string;
    /** Bir ana deponun kendisi + "Ana Depoya Dahil Et" işaretli alt depolarının birleşik görünümü. */
    parentAggregateId?: string;
    /** Kök seviye "Bütün Ürünler": includeInParentTotal=false işaretli Ana Depo'lar hariç tutulur. */
    rootAggregate?: boolean;
    search?: string;
    categoryId?: string;
    criticalOnly?: boolean;
    page: number;
    limit: number;
  }) {
    const { actor, search, categoryId, criticalOnly, page, limit } = params;

    let warehouseFilter: { warehouseId: string | { in: string[] } };
    if (params.warehouseId) {
      warehouseFilter = {
        warehouseId: await assertWarehouseAccess(
          this.prisma,
          actor,
          params.warehouseId,
        ),
      };
    } else if (params.parentAggregateId) {
      await assertWarehouseAccess(this.prisma, actor, params.parentAggregateId);
      const subtreeIds = await getWarehouseSubtreeIds(
        this.prisma,
        params.parentAggregateId,
        { onlyIncluded: true },
      );
      const accessible = await getAccessibleWarehouseIds(this.prisma, actor);
      const accessibleSet = new Set(accessible);
      warehouseFilter = {
        warehouseId: { in: subtreeIds.filter((id) => accessibleSet.has(id)) },
      };
    } else if (params.rootAggregate) {
      const accessible = await getAccessibleWarehouseIds(this.prisma, actor);
      const ownerId = ownerScopeFor(actor);
      if (ownerId) {
        const rootAggregateIds = new Set(
          await getRootAggregateWarehouseIds(this.prisma, ownerId),
        );
        warehouseFilter = {
          warehouseId: {
            in: accessible.filter((id) => rootAggregateIds.has(id)),
          },
        };
      } else {
        warehouseFilter = { warehouseId: { in: accessible } };
      }
    } else {
      warehouseFilter = {
        warehouseId: {
          in: await getAccessibleWarehouseIds(this.prisma, actor),
        },
      };
    }

    const where = {
      ...warehouseFilter,
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { name: { contains: search } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const filtered = criticalOnly
      ? items.filter((p) => p.currentStock <= p.criticalLevel)
      : items;

    return { items: filtered, total, page, limit };
  }

  /** Ürünleri admin'in istediği sırayla dizer (sürükle-bırak). */
  async reorder(ids: string[], actor: User) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return { success: true };

    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, warehouseId: true },
    });
    if (products.length !== uniqueIds.length) {
      throw new NotFoundException('Bazı ürünler bulunamadı');
    }

    if (actor.role !== 'PLATFORM_ADMIN') {
      const accessible = await getAccessibleWarehouseIds(this.prisma, actor);
      for (const product of products) {
        if (!accessible.includes(product.warehouseId)) {
          throw new ForbiddenException('Bu ürüne erişiminiz yok');
        }
      }
    }

    await this.prisma.$transaction(
      uniqueIds.map((id, index) =>
        this.prisma.product.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.auditLog.log({
      userId: actor.id,
      action: 'REORDER',
      resource: 'PRODUCT',
      meta: { count: uniqueIds.length },
    });

    return { success: true };
  }

  async findOne(id: string, actor: User) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    if (actor.role !== 'PLATFORM_ADMIN') {
      const accessible = await getAccessibleWarehouseIds(this.prisma, actor);
      if (!accessible.includes(product.warehouseId)) {
        throw new NotFoundException('Ürün bulunamadı');
      }
    }
    return product;
  }

  async create(dto: CreateProductDto, actor: User) {
    await assertWarehouseAccess(this.prisma, actor, dto.warehouseId);

    const existing = await this.prisma.product.findUnique({
      where: {
        warehouseId_name: { warehouseId: dto.warehouseId, name: dto.name },
      },
    });
    if (existing) {
      throw new ConflictException('Bu ürün adı bu depoda zaten kullanılıyor');
    }

    const last = await this.prisma.product.findFirst({
      where: { warehouseId: dto.warehouseId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        unit: dto.unit ?? 'adet',
        categoryId: dto.categoryId,
        warehouseId: dto.warehouseId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        leadTimeDays: dto.leadTimeDays ?? 5,
        safetyMarginDays: dto.safetyMarginDays ?? 3,
        criticalLevel: dto.criticalLevel,
        criticalLevelManual: dto.criticalLevel,
      },
    });

    if (dto.openingStock && dto.openingStock > 0) {
      await this.stockService.createMovement(
        {
          productId: product.id,
          type: MovementType.ADJUSTMENT,
          quantity: dto.openingStock,
          reason: 'Açılış stoğu',
        },
        actor,
      );
    }

    await this.auditLog.log({
      userId: actor.id,
      action: 'CREATE',
      resource: 'PRODUCT',
      resourceId: product.id,
      meta: { name: product.name },
    });

    return this.findOne(product.id, actor);
  }

  async update(id: string, dto: UpdateProductDto, actor: User) {
    const target = await this.findOne(id, actor);
    const cascade = dto.applyToAllWarehouses === true;
    const originalName = target.name;

    if (dto.name && dto.name !== target.name) {
      const existing = await this.prisma.product.findUnique({
        where: {
          warehouseId_name: { warehouseId: target.warehouseId, name: dto.name },
        },
      });
      if (existing)
        throw new ConflictException('Bu ürün adı bu depoda zaten kullanılıyor');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.leadTimeDays !== undefined) data.leadTimeDays = dto.leadTimeDays;
    if (dto.safetyMarginDays !== undefined)
      data.safetyMarginDays = dto.safetyMarginDays;
    if (dto.criticalLevel !== undefined) {
      data.criticalLevel = dto.criticalLevel;
      data.criticalLevelManual = dto.criticalLevel;
    }

    // "Bütün Ürünler" görünümünden düzenlenirse, aynı sahibin diğer depolarındaki
    // aynı isme sahip ürünler de (isim dahil) aynı değerlerle güncellenir.
    let siblings: { id: string; warehouseId: string }[] = [];
    if (cascade) {
      const targetWarehouse = await this.prisma.warehouse.findUnique({
        where: { id: target.warehouseId },
        select: { ownerId: true },
      });
      if (targetWarehouse) {
        siblings = await this.prisma.product.findMany({
          where: {
            name: originalName,
            id: { not: target.id },
            warehouse: { ownerId: targetWarehouse.ownerId },
          },
          select: { id: true, warehouseId: true },
        });
      }

      if (dto.name && dto.name !== originalName && siblings.length > 0) {
        const conflicts = await this.prisma.product.findMany({
          where: {
            name: dto.name,
            warehouseId: { in: siblings.map((s) => s.warehouseId) },
          },
          select: { warehouseId: true },
        });
        if (conflicts.length > 0) {
          throw new ConflictException(
            'Bu ürün adı diğer depolardan birinde zaten kullanılıyor, değişiklik tüm depolara uygulanamadı',
          );
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data }),
      ...siblings.map((s) =>
        this.prisma.product.update({ where: { id: s.id }, data }),
      ),
    ]);

    await this.auditLog.log({
      userId: actor.id,
      action: 'UPDATE',
      resource: 'PRODUCT',
      resourceId: id,
      meta: {
        changes: Object.keys(data),
        ...(siblings.length > 0
          ? { cascadedToWarehouses: siblings.length }
          : {}),
      },
    });

    if (dto.leadTimeDays !== undefined || dto.safetyMarginDays !== undefined) {
      await this.stockService.recomputeSuggestion(id);
      for (const sibling of siblings) {
        await this.stockService.recomputeSuggestion(sibling.id);
      }
    }

    return this.findOne(id, actor);
  }

  async remove(id: string, actor: User) {
    const target = await this.findOne(id, actor);
    await this.prisma.product.delete({ where: { id } });
    await deleteImageFile(target.imageUrl);
    await this.auditLog.log({
      userId: actor.id,
      action: 'DELETE',
      resource: 'PRODUCT',
      resourceId: id,
      meta: { name: target.name },
    });
    return { success: true };
  }

  async setImage(id: string, imageUrl: string, actor: User) {
    const target = await this.findOne(id, actor);
    await deleteImageFile(target.imageUrl);
    await this.prisma.product.update({ where: { id }, data: { imageUrl } });
    await this.auditLog.log({
      userId: actor.id,
      action: 'UPDATE_IMAGE',
      resource: 'PRODUCT',
      resourceId: id,
      meta: { imageUrl },
    });
    return this.findOne(id, actor);
  }

  /** Var olan bir ürünü, aynı bilgilerle başka bir depoya hızlıca ekler (stok sıfırdan başlar). */
  async duplicate(id: string, dto: DuplicateProductDto, actor: User) {
    const source = await this.findOne(id, actor);
    await assertWarehouseAccess(this.prisma, actor, dto.targetWarehouseId);

    if (dto.targetWarehouseId === source.warehouseId) {
      throw new ConflictException('Ürün zaten bu depoda');
    }

    // Varlık kontrolü + oluşturma tek transaction içinde yapılır: SQLite yazma
    // transaction'ları sırayla yürüdüğü için bu, eşzamanlı iki "hızlı ekle"
    // isteğinin ikisinin de "yok" görüp unique constraint'e çarpmasını
    // (P2002 → beklenmedik 500) engeller — ikinci istek artık ilkinin
    // oluşturduğu kaydı görüp "stoğa ekle" yoluna düşer.
    const { product: targetProduct, merged } = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.product.findUnique({
          where: {
            warehouseId_name: {
              warehouseId: dto.targetWarehouseId,
              name: source.name,
            },
          },
        });

        // Hedef depoda aynı isimde ürün zaten varsa hata vermek yerine hızlı
        // ekleme yapılır — AMA sadece kategori ve birim de eşleşiyorsa. Aksi
        // halde farklı ürünlerin stokları sessizce birleştirilmiş olur.
        if (existing) {
          if (
            existing.categoryId !== source.categoryId ||
            existing.unit !== source.unit
          ) {
            throw new ConflictException(
              'Hedef depoda bu isimde ama farklı kategori/birime sahip bir ürün zaten var — hızlı eklenemedi',
            );
          }
          return { product: existing, merged: true as const };
        }

        const last = await tx.product.findFirst({
          where: { warehouseId: dto.targetWarehouseId },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });

        const created = await tx.product.create({
          data: {
            name: source.name,
            description: source.description,
            unit: source.unit,
            categoryId: source.categoryId,
            warehouseId: dto.targetWarehouseId,
            sortOrder: (last?.sortOrder ?? -1) + 1,
            leadTimeDays: source.leadTimeDays,
            safetyMarginDays: source.safetyMarginDays,
            criticalLevel: source.criticalLevel,
            criticalLevelManual: source.criticalLevel,
          },
        });
        return { product: created, merged: false as const };
      },
    );

    if (dto.openingStock && dto.openingStock > 0) {
      await this.stockService.createMovement(
        {
          productId: targetProduct.id,
          type: merged ? MovementType.IN : MovementType.ADJUSTMENT,
          quantity: dto.openingStock,
          reason: `${source.name} — başka depodan hızlı eklendi`,
        },
        actor,
      );
    }

    await this.auditLog.log({
      userId: actor.id,
      action: merged ? 'UPDATE' : 'CREATE',
      resource: 'PRODUCT',
      resourceId: targetProduct.id,
      meta: merged
        ? {
            name: targetProduct.name,
            quickAddFrom: source.id,
            addedQuantity: dto.openingStock ?? 0,
          }
        : {
            name: targetProduct.name,
            duplicatedFrom: source.id,
          },
    });

    return this.findOne(targetProduct.id, actor);
  }
}
