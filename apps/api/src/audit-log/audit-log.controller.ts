import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { Role as PrismaRole, User } from '@prisma/client';
import { Role } from '@repo/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.ADMIN)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(
    @CurrentUser() actor: User,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('includeSelf') includeSelf?: string,
  ) {
    // Admin, kendi ekibindeki "Kullanıcı" rolündeki hesapların aktivitelerini görür.
    // Platform Admin (Developer Paneli) sistemdeki her işlemi görür.
    const actorRoles =
      actor.role === 'ADMIN' ? (['USER'] satisfies PrismaRole[]) : undefined;
    const adminOwnerId = actor.role === 'ADMIN' ? actor.id : undefined;
    // Varsayılan davranış değişmez: sadece "includeSelf=true" istendiğinde
    // Admin'in kendi işlemleri de ekip aktivitelerine eklenir.
    const includeOwnActionsFor =
      actor.role === 'ADMIN' && includeSelf === 'true' ? actor.id : undefined;
    return this.auditLogService.findAll({
      page: Number(page) || 1,
      limit: Number(limit) || 25,
      resource,
      userId,
      from,
      to,
      actorRoles,
      adminOwnerId,
      includeOwnActionsFor,
    });
  }
}
