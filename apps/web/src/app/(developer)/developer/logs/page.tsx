'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
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
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', resource, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (resource) params.set('resource', resource);
      return clientFetch<Paginated<AuditLogEntry>>(`/audit-logs?${params.toString()}`);
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Sistem Logları</h1>
          <p className="mt-1 text-sm text-muted">
            Sistemdeki tüm oluşturma, güncelleme ve silme işlemlerinin denetim kaydı.
          </p>
        </div>
        <Select
          value={resource}
          onChange={(e) => {
            setResource(e.target.value);
            setPage(1);
          }}
          className="sm:w-56"
        >
          {RESOURCE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r ? RESOURCE_LABEL[r] : 'Tüm kaynaklar'}
            </option>
          ))}
        </Select>
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
