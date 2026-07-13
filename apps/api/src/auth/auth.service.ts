import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { parseTtlMs } from '../common/utils/parse-ttl';
import { sanitizeUser } from '../common/utils/sanitize-user';
import { PrismaService } from '../prisma/prisma.service';

interface RefreshPayload {
  sub: string;
  jti?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async issueTokens(userId: string, role: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>(
          'JWT_ACCESS_TTL',
          '15m',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const jti = randomUUID();
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, role, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        expiresAt: new Date(Date.now() + parseTtlMs(refreshTtl)),
      },
    });

    return { accessToken, refreshToken };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        adminOwner: { select: { id: true, name: true } },
        warehouseAccess: { select: { warehouseId: true } },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı');
    }
    const tokens = await this.issueTokens(user.id, user.role);
    await this.auditLog.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'AUTH',
    });
    return { ...tokens, user: sanitizeUser(user) };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş oturum');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Geçersiz oturum');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (stored?.revokedAt) {
      // Reuse tespiti: bu jti daha önce rotasyon/logout ile iptal edilmişti, yine de
      // kullanılmaya çalışılıyor — bu, çalınmış bir refresh token'ın işareti olabilir.
      // Pasif ret yerine, güvenlik önlemi olarak kullanıcının TÜM aktif oturumları
      // iptal edilir (tüm cihazlardan zorunlu çıkış) ve olay audit log'a yazılır.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.auditLog.log({
        userId: stored.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        resource: 'AUTH',
      });
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş oturum');
    }

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş oturum');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        adminOwner: { select: { id: true, name: true } },
        warehouseAccess: { select: { warehouseId: true } },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Kullanıcı bulunamadı veya pasif');
    }

    // Rotasyon: kullanılan refresh token'ı geçersiz kıl, yeni bir çift üret.
    await this.prisma.refreshToken.update({
      where: { id: payload.jti },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: sanitizeUser(user) };
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Token zaten geçersiz veya süresi dolmuş — yapılacak bir şey yok.
    }
    return { success: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Mevcut şifre hatalı');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.auditLog.log({
      userId,
      action: 'CHANGE_PASSWORD',
      resource: 'AUTH',
    });
    return { success: true };
  }
}
