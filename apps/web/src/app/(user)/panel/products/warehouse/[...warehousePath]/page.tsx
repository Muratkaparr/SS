'use client';

import { useParams } from 'next/navigation';
import { UserProductsPageContent } from '@/components/products/user-products-page-content';

export default function UserProductsWarehousePage() {
  const params = useParams<{ warehousePath: string[] }>();
  return <UserProductsPageContent path={params.warehousePath ?? []} />;
}
