import { Injectable } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    meta?: Record<string, unknown>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        meta: params.meta ? JSON.stringify(params.meta) : null,
      },
    });
  }

  async findAll(params: {
    page: number;
    limit: number;
    resource?: string;
    userId?: string;
    /** Sadece bu rol(ler)deki kullanıcıların işlemleri getirilir (ör. Admin panelinden "Kullanıcı Aktiviteleri" görünümü). */
    actorRoles?: Role[];
    /** Sadece bu Admin'in ekibindeki kullanıcıların işlemleri getirilir. */
    adminOwnerId?: string;
  }) {
    const { page, limit, resource, userId, actorRoles, adminOwnerId } = params;
    const hasUserFilter =
      (actorRoles && actorRoles.length > 0) || !!adminOwnerId;
    const where = {
      ...(resource ? { resource } : {}),
      ...(userId ? { userId } : {}),
      ...(hasUserFilter
        ? {
            user: {
              is: {
                ...(actorRoles && actorRoles.length > 0
                  ? { role: { in: actorRoles } }
                  : {}),
                ...(adminOwnerId ? { adminOwnerId } : {}),
              },
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
