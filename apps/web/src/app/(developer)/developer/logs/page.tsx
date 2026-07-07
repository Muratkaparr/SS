'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import type { PublicUser } from '@repo/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/client-fetch';
import type { AuditLogEntry, Paginated } from '@/lib/types';

const RESOURCE_OPTIONS = ['', 'PRODUCT', 'STOCK_MOVEMENT', 'USER', 'AUTH'];
const RESOURCE_LABEL: Record<string, string> = {
  PRODUCT: 'Ürün',
  STOCK_MOVEMENT: 'Stok Hareketi',
  USER: 'Kullanıcı',
  AUTH: 'Oturum',
};

const ACTION_TONE: Record<string, 'success' | 'accent' | 'danger' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'accent',
  DELETE: 'danger',
  LOGIN: 'neutral',
  APPLY_SUGGESTION: 'accent',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DeveloperLogsPage() {
  const [resource, setResource] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => clientFetch<Paginated<PublicUser>>('/users?limit=200'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', resource, userId, from, to, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (resource) params.set('resource', resource);
      if (userId) params.set('userId', userId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return clientFetch<Paginated<AuditLogEntry>>(`/audit-logs?${params.toString()}`);
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  function resetPageAnd<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Sistem Logları</h1>
          <p className="mt-1 text-sm text-muted">
            Sistemdeki tüm oluşturma, güncelleme ve silme işlemlerinin denetim kaydı.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Select
            value={resource}
            onChange={(e) => resetPageAnd(setResource)(e.target.value)}
            className="sm:w-44"
          >
            {RESOURCE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r ? RESOURCE_LABEL[r] : 'Tüm kaynaklar'}
              </option>
            ))}
          </Select>
          <Select
            value={userId}
            onChange={(e) => resetPageAnd(setUserId)(e.target.value)}
            className="sm:w-44"
          >
            <option value="">Tüm kullanıcılar</option>
            {usersData?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => resetPageAnd(setFrom)(e.target.value)}
            className="sm:w-40"
            aria-label="Başlangıç tarihi"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => resetPageAnd(setTo)(e.target.value)}
            className="sm:w-40"
            aria-label="Bitiş tarihi"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface">
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="Kayıt bulunamadı" />
        ) : (
          <Table>
            <Thead>
              <Th>Tarih</Th>
              <Th>Kullanıcı</Th>
              <Th>Rol</Th>
              <Th>İşlem</Th>
              <Th>Kaynak</Th>
            </Thead>
            <Tbody>
              {data.items.map((log) => (
                <Tr key={log.id}>
                  <Td className="text-muted">{formatDateTime(log.createdAt)}</Td>
                  <Td>{log.user?.name ?? 'Sistem'}</Td>
                  <Td className="text-muted">{log.user?.role ?? '—'}</Td>
                  <Td>
                    <Badge tone={ACTION_TONE[log.action] ?? 'neutral'} withIcon={false}>
                      {log.action}
                    </Badge>
                  </Td>
                  <Td className="text-muted">
                    {RESOURCE_LABEL[log.resource] ?? log.resource}
                    {log.resourceId && (
                      <span className="ml-1 font-mono text-xs">#{log.resourceId.slice(0, 8)}</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {data && data.total > limit && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Sayfa {page} / {totalPages} · {data.total} kayıt
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
