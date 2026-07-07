import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async create(name: string, actor: User) {
    const existing = await this.prisma.category.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException('Bu isimde bir kategori zaten var');
    }
    const category = await this.prisma.category.create({ data: { name } });
    await this.auditLog.log({
      userId: actor.id,
      action: 'CREATE',
      resource: 'CATEGORY',
      resourceId: category.id,
      meta: { name: category.name },
    });
    return category;
  }

  async update(id: string, name: string, actor: User) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    if (name !== category.name) {
      const existing = await this.prisma.category.findUnique({
        where: { name },
      });
      if (existing) {
        throw new ConflictException('Bu isimde bir kategori zaten var');
      }
    }
    const updated = await this.prisma.category.update({
      where: { id },
      data: { name },
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'UPDATE',
      resource: 'CATEGORY',
      resourceId: id,
      meta: { name: updated.name },
    });
    return updated;
  }

  /** Kategoriye bağlı ürünler silinmez — kategorisiz kalır. */
  async remove(id: string, actor: User) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    await this.prisma.$transaction([
      this.prisma.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      }),
      this.prisma.category.delete({ where: { id } }),
    ]);
    await this.auditLog.log({
      userId: actor.id,
      action: 'DELETE',
      resource: 'CATEGORY',
      resourceId: id,
      meta: { name: category.name },
    });
    return { success: true };
  }
}
