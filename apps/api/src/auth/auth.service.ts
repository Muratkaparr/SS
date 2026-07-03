import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { sanitizeUser } from '../common/utils/sanitize-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_TTL',
        '15m',
      ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_TTL',
        '7d',
      ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    return { accessToken, refreshToken };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { adminOwner: { select: { id: true, name: true } } },
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
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş oturum');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { adminOwner: { select: { id: true, name: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Kullanıcı bulunamadı veya pasif');
    }
    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: sanitizeUser(user) };
  }
}
