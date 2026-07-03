import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Role } from '@repo/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { sanitizeUser } from '../common/utils/sanitize-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const ADMIN_OWNER_SELECT = {
  adminOwner: { select: { id: true, name: true } },
} as const;

/** Admin (Platform Admin değil) sadece kendi ekibindeki USER rolündeki hesapları yönetebilir. */
function isScopedAdmin(actor: User) {
  return actor.role === 'ADMIN';
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(actor: User) {
    const users = await this.prisma.user.findMany({
      where: isScopedAdmin(actor)
        ? { role: Role.USER, adminOwnerId: actor.id }
        : {},
      orderBy: { createdAt: 'asc' },
      include: ADMIN_OWNER_SELECT,
    });
    return users.map(sanitizeUser);
  }

  async create(dto: CreateUserDto, actor: User) {
    let adminOwnerId: string | null;

    if (isScopedAdmin(actor)) {
      if (dto.role !== Role.USER) {
        throw new ForbiddenException(
          'Admin sadece "Kullanıcı" rolünde hesap oluşturabilir',
        );
      }
      adminOwnerId = actor.id;
    } else if (dto.role !== Role.USER) {
      // ADMIN veya PLATFORM_ADMIN oluşturuluyor: kendi depo havuzunu kendisi yönetir.
      adminOwnerId = null;
    } else {
      if (!dto.adminOwnerId) {
        throw new BadRequestException(
          '"Kullanıcı" rolü için bir Admin seçilmeli',
        );
      }
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.adminOwnerId },
      });
      if (!owner || owner.role !== 'ADMIN') {
        throw new NotFoundException('Belirtilen Admin bulunamadı');
      }
      adminOwnerId = owner.id;
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Bu kullanıcı adı zaten kayıtlı');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        name: dto.name,
        role: dto.role,
        passwordHash,
        adminOwnerId,
      },
      include: ADMIN_OWNER_SELECT,
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'CREATE',
      resource: 'USER',
      resourceId: user.id,
      meta: { username: user.username, role: user.role },
    });
    return sanitizeUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: User) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const targetRole = target.role as unknown as Role;
    const scoped = isScopedAdmin(actor);

    if (scoped) {
      if (targetRole !== Role.USER || target.adminOwnerId !== actor.id) {
        throw new ForbiddenException(
          'Admin sadece kendi ekibindeki "Kullanıcı" hesaplarını düzenleyebilir',
        );
      }
      if (dto.role && dto.role !== Role.USER) {
        throw new ForbiddenException(
          'Admin bir hesabı "Kullanıcı" rolünden farklı bir role yükseltemez',
        );
      }
    }

    const isSelf = target.id === actor.id;
    const isDemotingOrDeactivatingSelf =
      isSelf &&
      ((dto.role && dto.role !== targetRole) ||
        (dto.isActive !== undefined && dto.isActive !== target.isActive));
    if (isDemotingOrDeactivatingSelf) {
      throw new ForbiddenException(
        'Kendi rolünüzü veya aktiflik durumunuzu değiştiremezsiniz',
      );
    }

    const isDemotingLastPlatformAdmin =
      targetRole === Role.PLATFORM_ADMIN &&
      ((dto.role && dto.role !== Role.PLATFORM_ADMIN) ||
        dto.isActive === false);
    if (isDemotingLastPlatformAdmin) {
      const activeCount = await this.prisma.user.count({
        where: { role: Role.PLATFORM_ADMIN, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException(
          'Sistemde en az bir aktif Platform Admin kalmalı',
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    if (!scoped) {
      // Sadece Platform Admin kullanıcı adını değiştirebilir.
      if (dto.username !== undefined && dto.username !== target.username) {
        const existing = await this.prisma.user.findUnique({
          where: { username: dto.username },
        });
        if (existing) {
          throw new ConflictException('Bu kullanıcı adı zaten kayıtlı');
        }
        data.username = dto.username;
      }

      // Sadece Platform Admin rol/ekip ataması değiştirebilir.
      const nextRole = dto.role ?? targetRole;
      if (dto.role !== undefined) data.role = dto.role;

      if (nextRole !== Role.USER) {
        data.adminOwnerId = null;
      } else if (dto.adminOwnerId !== undefined) {
        const owner = await this.prisma.user.findUnique({
          where: { id: dto.adminOwnerId },
        });
        if (!owner || owner.role !== 'ADMIN') {
          throw new NotFoundException('Belirtilen Admin bulunamadı');
        }
        data.adminOwnerId = owner.id;
      } else if (dto.role !== undefined && targetRole !== Role.USER) {
        // Admin/Platform Admin'den USER'a indiriliyor ama sahibi verilmedi
        throw new BadRequestException(
          '"Kullanıcı" rolü için bir Admin seçilmeli',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: ADMIN_OWNER_SELECT,
    });
    await this.auditLog.log({
      userId: actor.id,
      action: 'UPDATE',
      resource: 'USER',
      resourceId: id,
      meta: { changes: Object.keys(data) },
    });
    return sanitizeUser(updated);
  }

  async remove(id: string, actor: User) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    if (target.id === actor.id) {
      throw new ForbiddenException('Kendi hesabınızı silemezsiniz');
    }
    const targetRole = target.role as unknown as Role;
    if (isScopedAdmin(actor)) {
      if (targetRole !== Role.USER || target.adminOwnerId !== actor.id) {
        throw new ForbiddenException(
          'Admin sadece kendi ekibindeki "Kullanıcı" hesaplarını silebilir',
        );
      }
    }
    if (targetRole === Role.PLATFORM_ADMIN) {
      const activeCount = await this.prisma.user.count({
        where: { role: Role.PLATFORM_ADMIN, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException(
          'Sistemde en az bir aktif Platform Admin kalmalı',
        );
      }
    }
    await this.prisma.user.delete({ where: { id } });
    await this.auditLog.log({
      userId: actor.id,
      action: 'DELETE',
      resource: 'USER',
      resourceId: id,
      meta: { username: target.username },
    });
    return { success: true };
  }
}
