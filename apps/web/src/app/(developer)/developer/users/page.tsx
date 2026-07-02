import { UsersManager } from '@/components/users/users-manager';
import { serverFetch } from '@/lib/server-fetch';
import type { PublicUser } from '@repo/shared-types';

export default async function DeveloperUsersPage() {
  const me = await serverFetch<PublicUser>('/auth/me');
  return (
    <UsersManager
      currentUserId={me.id}
      description="Sistemdeki tüm hesapları (Admin ve Kullanıcı dahil) oluşturun, yetki değiştirin veya erişimi kaldırın."
    />
  );
}
