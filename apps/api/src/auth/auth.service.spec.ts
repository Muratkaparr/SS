import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };

  async function loginAsBob(password = 'correct-password') {
    const passwordHash = bcrypt.hashSync(password, 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'bob',
      name: 'Bob',
      role: 'ADMIN',
      isActive: true,
      passwordHash,
      createdAt: new Date(),
      adminOwnerId: null,
    });
    prisma.refreshToken.create.mockResolvedValue({});
    return service.login('bob', password);
  }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    auditLog = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => CONFIG[key] ?? fallback,
            getOrThrow: (key: string) => {
              const value = CONFIG[key];
              if (!value) throw new Error(`missing config: ${key}`);
              return value;
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('rejects an unknown username', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nobody', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        username: 'bob',
        isActive: true,
        passwordHash: bcrypt.hashSync('correct-password', 10),
      });
      await expect(service.login('bob', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues tokens and persists a refresh-token row on success', async () => {
      const result = await loginAsBob();
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN', resource: 'AUTH' }),
      );
    });
  });

  describe('refresh', () => {
    it('rotates the token: issues a new pair and revokes the old row', async () => {
      const { refreshToken } = await loginAsBob();
      const usedId = prisma.refreshToken.create.mock.calls[0][0].data.id;

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: usedId,
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockClear();
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(refreshToken);
      expect(result.accessToken).toEqual(expect.any(String));
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: usedId },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a refresh token whose stored row has already been revoked (reuse), and revokes all of that user\'s active sessions', async () => {
      const { refreshToken } = await loginAsBob();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'whatever',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      // Reuse tespit edildiğinde çalınmış olabilecek token'ın ötesinde, kullanıcının
      // TÜM aktif oturumları iptal edilmeli (tüm cihazlardan zorunlu çıkış).
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          resource: 'AUTH',
        }),
      );
    });

    it('rejects a token that simply does not exist in storage, without treating it as reuse', async () => {
      const { refreshToken } = await loginAsBob();
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a syntactically invalid token', async () => {
      await expect(service.refresh('not-a-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the refresh token row', async () => {
      const { refreshToken } = await loginAsBob();
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(refreshToken);
      expect(result).toEqual({ success: true });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('does not throw for a garbage token (best-effort)', async () => {
      await expect(service.logout('garbage')).resolves.toEqual({
        success: true,
      });
    });
  });

  describe('changePassword', () => {
    it('rejects when the current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: bcrypt.hashSync('correct-password', 10),
      });
      await expect(
        service.changePassword('u1', 'wrong', 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('updates the password hash on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: bcrypt.hashSync('correct-password', 10),
      });
      prisma.user.update.mockResolvedValue({});

      await service.changePassword('u1', 'correct-password', 'new-password');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: expect.any(String) },
      });
    });
  });
});
