'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { clientFetch } from '@/lib/client-fetch';
import type { Warehouse } from '@/lib/types';

const ROOT_VALUE = '__root__';

/** Verilen deponun kendisi + tüm alt ağacı — bunlar geçerli hedef olamaz (döngü olur). */
function collectSubtreeIds(all: Warehouse[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, Warehouse[]>();
  for (const w of all) {
    if (!w.parentId) continue;
    const list = childrenByParent.get(w.parentId) ?? [];
    list.push(w);
    childrenByParent.set(w.parentId, list);
  }
  const result = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of childrenByParent.get(id) ?? []) queue.push(child.id);
  }
  return result;
}

export function MoveWarehouseModal({
  warehouse,
  open,
  onClose,
}: {
  warehouse: Warehouse;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState(warehouse.parentId ?? ROOT_VALUE);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: allWarehouses } = useQuery({
    queryKey: ['warehouses', 'flat-all'],
    queryFn: () => clientFetch<Warehouse[]>('/warehouses'),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal her açıldığında formu sıfırla
      setServerError(null);
      setTargetId(warehouse.parentId ?? ROOT_VALUE);
    }
  }, [open, warehouse.parentId]);

  const excludedIds = useMemo(
    () =>
      allWarehouses ? collectSubtreeIds(allWarehouses, warehouse.id) : new Set([warehouse.id]),
    [allWarehouses, warehouse.id],
  );
  const eligibleTargets = (allWarehouses ?? []).filter((w) => !excludedIds.has(w.id));

  const mutation = useMutation({
    mutationFn: () =>
      clientFetch(`/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ parentId: targetId === ROOT_VALUE ? null : targetId }),
      }),
    onSuccess: () => {
      toast.success('Depo taşındı');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={`"${warehouse.name}" Deposunu Taşı`} className="max-w-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setServerError(null);
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          Bu depoyu var olan içeriğini kaybetmeden başka bir Ana Depo&apos;nun altına alt depo
          olarak taşıyabilir, ya da bağımsız bir Ana Depo yapabilirsiniz.
        </p>

        {serverError && (
          <p className="rounded-sm bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>
        )}

        <div>
          <Label htmlFor="move-target">Yeni Üst Depo</Label>
          <Select id="move-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value={ROOT_VALUE}>— Ana Depo (bağımsız) —</option>
            {eligibleTargets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Taşı
          </Button>
        </div>
      </form>
    </Modal>
  );
}
