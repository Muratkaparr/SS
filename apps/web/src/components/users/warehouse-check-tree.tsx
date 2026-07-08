'use client';

import { useQuery } from '@tanstack/react-query';
import { clientFetch } from '@/lib/client-fetch';
import type { Warehouse } from '@/lib/types';

function groupByParent(flat: Warehouse[]) {
  const byParent = new Map<string | null, Warehouse[]>();
  for (const w of flat) {
    const key = w.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), w]);
  }
  return byParent;
}

function TreeNode({
  warehouse,
  depth,
  byParent,
  selectedIds,
  onToggle,
}: {
  warehouse: Warehouse;
  depth: number;
  byParent: Map<string | null, Warehouse[]>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const children = byParent.get(warehouse.id) ?? [];
  return (
    <div>
      <label
        className="flex items-center gap-2 py-1 text-sm text-ink"
        style={{ paddingLeft: depth * 16 }}
      >
        <input
          type="checkbox"
          checked={selectedIds.includes(warehouse.id)}
          onChange={() => onToggle(warehouse.id)}
          className="h-3.5 w-3.5 shrink-0 rounded-sm border-border accent-primary"
        />
        <span className="truncate">{warehouse.name}</span>
      </label>
      {children.map((child) => (
        <TreeNode
          key={child.id}
          warehouse={child}
          depth={depth + 1}
          byParent={byParent}
          selectedIds={selectedIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

/**
 * Bir USER hesabına depo bazlı çalışma yetkisi atamak için ağaç görünümünde çoklu seçim.
 * `ownerId` sadece Platform Admin bağlamında gerekir (hangi Admin'in havuzu gösterilecek);
 * Admin panelinden çağrıldığında backend otomatik olarak kendi havuzunu döner.
 */
export function WarehouseCheckTree({
  ownerId,
  selectedIds,
  onChange,
}: {
  ownerId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: flat, isLoading } = useQuery({
    queryKey: ['warehouses', 'flat', ownerId ?? 'self'],
    queryFn: () => clientFetch<Warehouse[]>(`/warehouses${ownerId ? `?ownerId=${ownerId}` : ''}`),
  });

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  }

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-sm bg-surface-2" />;
  }

  const byParent = groupByParent(flat ?? []);
  const roots = byParent.get(null) ?? [];

  if (roots.length === 0) {
    return <p className="text-xs text-muted">Henüz depo bulunmuyor.</p>;
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-sm border border-border p-2">
      {roots.map((w) => (
        <TreeNode
          key={w.id}
          warehouse={w}
          depth={0}
          byParent={byParent}
          selectedIds={selectedIds}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}
