import { PrismaClient, MovementType, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  calculateConfidence,
  calculateSuggestedCriticalLevel,
} from '../src/stock/critical-level.util';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

async function recomputeSuggestion(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;
  const now = Date.now();

  const sumOut = async (since: Date, until?: Date) => {
    const result = await prisma.stockMovement.aggregate({
      where: {
        productId,
        type: MovementType.OUT,
        createdAt: { gte: since, ...(until ? { lt: until } : {}) },
      },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  };

  const outLast7d = await sumOut(new Date(now - 7 * DAY_MS));
  const outLast30d = await sumOut(new Date(now - 30 * DAY_MS));
  const priorWeekOut = await sumOut(
    new Date(now - 14 * DAY_MS),
    new Date(now - 7 * DAY_MS),
  );
  const firstMovement = await prisma.stockMovement.findFirst({
    where: { productId },
    orderBy: { createdAt: 'asc' },
  });

  const weeklyTrendSlope = outLast7d / 7 - priorWeekOut / 7;
  const { avgDailyConsumption7d, avgDailyConsumption30d, suggestedCriticalLevel } =
    calculateSuggestedCriticalLevel({
      outLast7d,
      outLast30d,
      leadTimeDays: product.leadTimeDays,
      safetyMarginDays: product.safetyMarginDays,
      weeklyTrendSlope,
    });
  const daysOfHistory = firstMovement
    ? Math.floor((now - firstMovement.createdAt.getTime()) / DAY_MS)
    : 0;

  await prisma.product.update({
    where: { id: productId },
    data: {
      avgDailyConsumption7d,
      avgDailyConsumption30d,
      suggestedCriticalLevel,
      confidence: calculateConfidence(daysOfHistory),
    },
  });
}

interface ProductSeed {
  name: string;
  categoryName: string;
  unit: string;
  criticalLevel: number;
  dailyOutRange: readonly [number, number];
  opening: number;
}

async function seedWarehouseProducts(
  warehouseId: string,
  adminId: string,
  productSeeds: ProductSeed[],
) {
  for (const seed of productSeeds) {
    const category = await prisma.category.upsert({
      where: { ownerId_name: { ownerId: adminId, name: seed.categoryName } },
      update: {},
      create: { name: seed.categoryName, ownerId: adminId },
    });

    const product = await prisma.product.upsert({
      where: { warehouseId_name: { warehouseId, name: seed.name } },
      update: {},
      create: {
        name: seed.name,
        categoryId: category.id,
        warehouseId,
        unit: seed.unit,
        criticalLevel: seed.criticalLevel,
        criticalLevelManual: seed.criticalLevel,
        currentStock: 0,
        leadTimeDays: 5,
        safetyMarginDays: 3,
      },
    });

    const existingMovements = await prisma.stockMovement.count({
      where: { productId: product.id },
    });
    if (existingMovements > 0) continue;

    let stock = 0;
    const movements: {
      productId: string;
      type: MovementType;
      quantity: number;
      userId: string;
      createdAt: Date;
    }[] = [];

    const openingDate = new Date(Date.now() - 35 * DAY_MS);
    movements.push({
      productId: product.id,
      type: MovementType.ADJUSTMENT,
      quantity: seed.opening,
      userId: adminId,
      createdAt: openingDate,
    });
    stock += seed.opening;

    for (let dayOffset = 34; dayOffset >= 0; dayOffset--) {
      const date = new Date(Date.now() - dayOffset * DAY_MS);
      const [min, max] = seed.dailyOutRange;
      const out = Math.floor(Math.random() * (max - min + 1)) + min;
      if (out > 0 && stock - out >= 0) {
        movements.push({
          productId: product.id,
          type: MovementType.OUT,
          quantity: out,
          userId: adminId,
          createdAt: date,
        });
        stock -= out;
      }
      if (dayOffset % 10 === 0 && dayOffset !== 0) {
        const restock = Math.floor(seed.opening / 4 + Math.random() * 10);
        movements.push({
          productId: product.id,
          type: MovementType.IN,
          quantity: restock,
          userId: adminId,
          createdAt: date,
        });
        stock += restock;
      }
    }

    await prisma.stockMovement.createMany({ data: movements });
    await prisma.product.update({
      where: { id: product.id },
      data: { currentStock: stock },
    });
    await recomputeSuggestion(product.id);
  }
}

async function upsertWarehouse(ownerId: string, name: string, location: string) {
  const existing = await prisma.warehouse.findFirst({
    where: { ownerId, parentId: null, name },
  });
  if (existing) return existing;
  return prisma.warehouse.create({ data: { ownerId, name, location } });
}

async function main() {
  const passwordHash = await bcrypt.hash('parola123', 10);

  const platformAdmin = await prisma.user.upsert({
    where: { username: 'developer' },
    update: {},
    create: {
      username: 'developer',
      name: 'Sistem Yöneticisi',
      role: Role.PLATFORM_ADMIN,
      passwordHash,
    },
  });

  // --- İstanbul Admin'i: birden fazla depo yönetiyor (sekme geçişini göstermek için) ---
  const istanbulAdmin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Depo Yöneticisi (İstanbul)',
      role: Role.ADMIN,
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { username: 'kullanici' },
    update: {},
    create: {
      username: 'kullanici',
      name: 'Depo Görevlisi (İstanbul)',
      role: Role.USER,
      passwordHash,
      adminOwnerId: istanbulAdmin.id,
    },
  });

  const merkezDepo = await upsertWarehouse(istanbulAdmin.id, 'Merkez Depo', 'İstanbul, Türkiye');
  await seedWarehouseProducts(merkezDepo.id, istanbulAdmin.id, [
    { name: 'USB-C Kablo 1m', categoryName: 'Elektronik', unit: 'adet', criticalLevel: 40, dailyOutRange: [3, 8], opening: 220 },
    { name: 'Kablosuz Mouse', categoryName: 'Elektronik', unit: 'adet', criticalLevel: 15, dailyOutRange: [0, 3], opening: 60 },
    { name: 'HDMI Adaptör', categoryName: 'Elektronik', unit: 'adet', criticalLevel: 10, dailyOutRange: [0, 2], opening: 18 },
  ]);

  const yedekDepo = await upsertWarehouse(istanbulAdmin.id, 'Yedek Depo', 'Tuzla, İstanbul');
  await seedWarehouseProducts(yedekDepo.id, istanbulAdmin.id, [
    { name: 'A4 Fotokopi Kağıdı (Paket)', categoryName: 'Kırtasiye', unit: 'paket', criticalLevel: 25, dailyOutRange: [2, 6], opening: 140 },
    { name: 'Toner Kartuşu HP 05A', categoryName: 'Kırtasiye', unit: 'adet', criticalLevel: 6, dailyOutRange: [0, 1], opening: 8 },
    { name: 'Yüzey Dezenfektanı 1L', categoryName: 'Temizlik', unit: 'şişe', criticalLevel: 20, dailyOutRange: [1, 5], opening: 95 },
  ]);

  // --- Ankara Admin'i: tek depo (endüstriyel/lojistik malzemeleri) ---
  const ankaraAdmin = await prisma.user.upsert({
    where: { username: 'ankara.admin' },
    update: {},
    create: {
      username: 'ankara.admin',
      name: 'Depo Yöneticisi (Ankara)',
      role: Role.ADMIN,
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { username: 'ankara.kullanici' },
    update: {},
    create: {
      username: 'ankara.kullanici',
      name: 'Depo Görevlisi (Ankara)',
      role: Role.USER,
      passwordHash,
      adminOwnerId: ankaraAdmin.id,
    },
  });

  const anadoluDepo = await upsertWarehouse(ankaraAdmin.id, 'Anadolu Depo', 'Ankara, Türkiye');
  await seedWarehouseProducts(anadoluDepo.id, ankaraAdmin.id, [
    { name: 'Endüstriyel İş Eldiveni', categoryName: 'Endüstriyel', unit: 'çift', criticalLevel: 30, dailyOutRange: [2, 6], opening: 160 },
    { name: 'İş Güvenliği Bareti', categoryName: 'Endüstriyel', unit: 'adet', criticalLevel: 12, dailyOutRange: [0, 2], opening: 45 },
    { name: 'Vida Seti (Karışık, 200 parça)', categoryName: 'Endüstriyel', unit: 'kutu', criticalLevel: 8, dailyOutRange: [0, 2], opening: 22 },
    { name: 'Palet Gerdirme Naylonu', categoryName: 'Lojistik', unit: 'rulo', criticalLevel: 15, dailyOutRange: [1, 4], opening: 70 },
    { name: 'Ambalaj Bandı 48mm', categoryName: 'Lojistik', unit: 'adet', criticalLevel: 20, dailyOutRange: [1, 5], opening: 85 },
    { name: 'Ahşap Euro Palet', categoryName: 'Lojistik', unit: 'adet', criticalLevel: 10, dailyOutRange: [0, 3], opening: 40 },
  ]);

  console.log('Seed tamamlandı.\n');
  console.log('İstanbul Admin (2 depo: Merkez Depo, Yedek Depo):');
  console.log('  Admin     : admin / parola123');
  console.log('  Kullanıcı : kullanici / parola123');
  console.log('\nAnkara Admin (1 depo: Anadolu Depo):');
  console.log('  Admin     : ankara.admin / parola123');
  console.log('  Kullanıcı : ankara.kullanici / parola123');
  console.log('\nPlatform Admin (tüm depoları görür):');
  console.log('  Developer : developer / parola123');
  console.log(`  (Platform Admin id: ${platformAdmin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
