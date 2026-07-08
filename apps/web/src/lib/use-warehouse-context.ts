'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@repo/shared-types';
import { clientFetch } from '@/lib/client-fetch';
import type { Warehouse } from '@/lib/types';

/**
 * Bir depo yolu (sidebar/ürünler sayfası breadcrumb'ı) için: hangi deponun içinde
 * olduğumuzu (null = kök), o bağlamın "Bütün Ürünler" etiketini ve bunu yeniden
 * adlandırma mutasyonunu çözer. Admin ve Kullanıcı panellerindeki ürünler sayfaları
 * arasında paylaşılır.
 */
export function useWarehouseContext(path: string[]) {
  const queryClient = useQueryClient();
  const lastId = path.length > 0 ? path[path.length - 1] : null;

  const ancestorQueries = useQueries({
    queries: path.map((id) => ({
      queryKey: ['warehouses', 'byId', id],
      queryFn: () => clientFetch<Warehouse>(`/warehouses/${id}`),
    })),
  });
  const breadcrumb = path.map((id, i) => ({
    id,
    name: ancestorQueries[i]?.data?.name ?? null,
  }));
  const isLoadingContext = ancestorQueries.some((q) => q.isLoading);

  const lastWarehouse = ancestorQueries.at(-1)?.data ?? null;
  // Alt deposu olmayan bir "yaprak" depo, kendi başına gezinilebilir bir bağlam değildir —
  // sekme şeridi onun yerine üst deponun (kardeşlerinin) bağlamını gösterir, bu depo da o
  // şeritte önceden seçili/vurgulu sekme olarak gelir (standart sekme davranışı).
  const lastIsLeaf = lastWarehouse !== null && lastWarehouse.childCount === 0;
  const currentParentId = lastIsLeaf
    ? path.length > 1
      ? path[path.length - 2]
      : null
    : lastId;
  const currentWarehouse = lastIsLeaf
    ? path.length > 1
      ? (ancestorQueries.at(-2)?.data ?? null)
      : null
    : lastWarehouse;
  const preselectedWarehouseId = lastIsLeaf ? lastId : null;

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => clientFetch<PublicUser>('/auth/me'),
    enabled: currentParentId === null,
  });

  const allLabel =
    currentParentId === null
      ? meQuery.data?.rootAllWarehousesLabel || 'Bütün Ürünler'
      : currentWarehouse?.allChildrenLabel || 'Bütün Ürünler';

  const renameRootLabelMutation = useMutation({
    mutationFn: (label: string) =>
      clientFetch('/warehouses/root-label', {
        method: 'PATCH',
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
  const renameChildLabelMutation = useMutation({
    mutationFn: (label: string) =>
      clientFetch(`/warehouses/${currentParentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ allChildrenLabel: label }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['warehouses', 'byId', currentParentId] }),
  });

  function renameAllLabel(label: string) {
    return currentParentId === null
      ? renameRootLabelMutation.mutateAsync(label)
      : renameChildLabelMutation.mutateAsync(label);
  }

  return {
    currentParentId,
    currentWarehouse,
    preselectedWarehouseId,
    breadcrumb,
    allLabel,
    renameAllLabel,
    isLoadingContext,
  };
}
