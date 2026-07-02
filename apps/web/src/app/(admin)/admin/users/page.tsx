import { UsersManager } from '@/components/users/users-manager';
import { serverFetch } from '@/lib/server-fetch';
import type { PublicUser } from '@repo/shared-types';

export default async function AdminUsersPage() {
  const me = await serverFetch<PublicUser>('/auth/me');
  return (
    <UsersManager
      currentUserId={me.id}
      restrictToUserRole
      description='Kendi ekibiniz için "Kullanıcı" rolünde hesap oluşturun ve yönetin.'
    />
  );
}
