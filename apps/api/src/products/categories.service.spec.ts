import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const ADMIN_A = { id: 'admin-a', role: 'ADMIN' } as User;
const ADMIN_B = { id: 'admin-b', role: 'ADMIN' } as User;
const PLATFORM_ADMIN = { id: 'platform-1', role: 'PLATFORM_ADMIN' } as User;

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    product: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: { updateMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    auditLog = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(CategoriesService);
  });

  describe('findAll', () => {
    it('scopes an ADMIN to only their own categories (cross-tenant leak regression)', async () => {
      await service.findAll(ADMIN_A);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'admin-a' },
        orderBy: { name: 'asc' },
      });
    });

    it('does not restrict PLATFORM_ADMIN by owner', async () => {
      await service.findAll(PLATFORM_ADMIN);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('update / remove ownership', () => {
    it('rejects an ADMIN updating a category owned by a different admin', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'Elektronik',
        ownerId: 'admin-b',
      });
      await expect(
        service.update('cat-1', 'Yeni İsim', ADMIN_A),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('rejects an ADMIN deleting a category owned by a different admin', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'Elektronik',
        ownerId: 'admin-b',
      });
      await expect(service.remove('cat-1', ADMIN_A)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('allows an ADMIN to update their own category', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce({ id: 'cat-1', name: 'Elektronik', ownerId: 'admin-a' })
        .mockResolvedValueOnce(null);
      prisma.category.update.mockResolvedValue({
        id: 'cat-1',
        name: 'Elektronik ve Bilişim',
        ownerId: 'admin-a',
      });

      const result = await service.update('cat-1', 'Elektronik ve Bilişim', ADMIN_A);
      expect(result).toMatchObject({ name: 'Elektronik ve Bilişim' });
    });
  });
});
