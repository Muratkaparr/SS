/**
 * Tehlikeli, tek seferlik bakım script'i: TÜM kullanıcıları (ve cascade ile
 * bağlı tüm depo/ürün/stok hareketi/kategori verisini) siler, ardından
 * admin / kullanici / developer hesaplarını parola123 şifresiyle yeniden
 * oluşturur. Deploy pipeline'ının BİR PARÇASI DEĞİLDİR — yalnızca sunucuda
 * elle çalıştırılmak içindir. Kazara çalıştırmayı önlemek için CONFIRM_WIPE
 * env değişkeni zorunludur.
 *
 * Kullanım (sunucuda, apps/api dizininde):
 *   $env:CONFIRM_WIPE = "YES_WIPE_ALL_DATA"
 *   pnpm db:reset-accounts
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_WIPE !== 'YES_WIPE_ALL_DATA') {
    console.error(
      'İptal edildi: bu script TÜM kullanıcıları ve bağlı tüm depo/ürün verisini ' +
        'kalıcı olarak siler. Devam etmek için CONFIRM_WIPE=YES_WIPE_ALL_DATA ' +
        'ortam değişkenini ayarlayıp tekrar çalıştırın.',
    );
    process.exit(1);
  }

  const [userCount, warehouseCount, productCount] = await Promise.all([
    prisma.user.count(),
    prisma.warehouse.count(),
    prisma.product.count(),
  ]);
  console.log(
    `Siliniyor: ${userCount} kullanıcı, ${warehouseCount} depo, ${productCount} ürün ` +
      '(Warehouse/Product/StockMovement/Category, User silinince cascade ile gider).',
  );

  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('parola123', 10);

  const developer = await prisma.user.create({
    data: {
      username: 'developer',
      name: 'Sistem Yöneticisi',
      role: Role.PLATFORM_ADMIN,
      passwordHash,
    },
  });

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      name: 'Depo Yöneticisi',
      role: Role.ADMIN,
      passwordHash,
    },
  });

  const kullanici = await prisma.user.create({
    data: {
      username: 'kullanici',
      name: 'Depo Görevlisi',
      role: Role.USER,
      passwordHash,
      adminOwnerId: admin.id,
    },
  });

  console.log('\nTemizlik ve yeniden oluşturma tamamlandı.\n');
  console.log(`Developer : developer / parola123  (id: ${developer.id})`);
  console.log(`Admin     : admin / parola123      (id: ${admin.id})`);
  console.log(`Kullanıcı : kullanici / parola123   (id: ${kullanici.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
