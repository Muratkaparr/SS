'use client';

import { useParams } from 'next/navigation';
import { AdminProductsPageContent } from '@/components/admin/admin-products-page-content';

export default function AdminProductsWarehousePage() {
  const params = useParams<{ warehousePath: string[] }>();
  return <AdminProductsPageContent path={params.warehousePath ?? []} />;
}
