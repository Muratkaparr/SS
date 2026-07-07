import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { Role } from '@repo/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const SCOPED_ADMIN = { id: 'admin-1', role: 'ADMIN' } as User;
const PLATFORM_ADMIN = { id: 'platform-1', role: 'PLATFORM_ADMIN' } as User;

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 'target-1',
    username: 'target',
    name: 'Target',
    role: Role.USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    adminOwnerId: null,
    passwordHash: 'hash',
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    auditLog = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    it('forbids a scoped Admin from creating a non-USER role account', async () => {
      await expect(
        service.create(
          { username: 'x', name: 'X', password: 'pw', role: Role.ADMIN } as any,
          SCOPED_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('forbids a scoped Admin from editing a user outside their team', async () => {
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ role: Role.USER, adminOwnerId: 'someone-else' }),
      );
      await expect(
        service.update('target-1', { name: 'New' } as any, SCOPED_ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids demoting or deactivating your own account', async () => {
      const self = baseUser({ id: 'admin-1', role: Role.ADMIN });
      prisma.user.findUnique.mockResolvedValue(self);
      await expect(
        service.update('admin-1', { isActive: false } as any, {
          ...SCOPED_ADMIN,
          id: 'admin-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks demoting the last active Platform Admin', async () => {
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ id: 'pa-1', role: Role.PLATFORM_ADMIN }),
      );
      prisma.user.count.mockResolvedValue(1);
      await expect(
        service.update('pa-1', { role: Role.ADMIN } as any, PLATFORM_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('forbids deleting your own account', async () => {
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ id: 'admin-1', role: Role.ADMIN }),
      );
      await expect(
        service.remove('admin-1', { ...SCOPED_ADMIN, id: 'admin-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks deleting the last active Platform Admin', async () => {
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ id: 'pa-2', role: Role.PLATFORM_ADMIN }),
      );
      prisma.user.count.mockResolvedValue(1);
      await expect(service.remove('pa-2', PLATFORM_ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('blocks deleting an Admin who still has managed users', async () => {
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ id: 'admin-2', role: Role.ADMIN }),
      );
      prisma.user.count.mockResolvedValue(3);
      await expect(service.remove('admin-2', PLATFORM_ADMIN)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deletes a plain user with no dependents', async () => {
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ id: 'user-1', role: Role.USER }),
      );
      prisma.user.count.mockResolvedValue(0);
      const result = await service.remove('user-1', PLATFORM_ADMIN);
      expect(result).toEqual({ success: true });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', resource: 'USER' }),
      );
    });
  });
});
