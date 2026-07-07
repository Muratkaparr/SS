'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarClock, Clock, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useNow } from '@/lib/use-now';
import { clientFetch } from '@/lib/client-fetch';
import type { AuditLogEntry, Paginated } from '@/lib/types';

const ACTION_TONE: Record<string, 'success' | 'accent' | 'danger' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'accent',
  DELETE: 'danger',
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Stok Girişi/Çıkışı',
};

const RESOURCE_LABEL: Record<string, string> = {
  STOCK_MOVEMENT: 'Stok Hareketi',
  PRODUCT: 'Ürün',
  WAREHOUSE: 'Depo',
  CATEGORY: 'Kategori',
  USER: 'Kullanıcı',
  AUTH: 'Oturum',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AdminActivityPage() {
  const [includeSelf, setIncludeSelf] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', 'user-activity', includeSelf],
    queryFn: () =>
      clientFetch<Paginated<AuditLogEntry>>(
        `/audit-logs?limit=200${includeSelf ? '&includeSelf=true' : ''}`,
      ),
    refetchInterval: 30_000,
  });

  const logs = useMemo(() => data?.items ?? [], [data]);
  const now = useNow();

  const summary = useMemo(() => {
    if (now == null) return { today: 0, lastHour: 0, lastMinute: 0 };
    const MIN = 60_000;
    const HOUR = 60 * MIN;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let today = 0;
    let lastHour = 0;
    let lastMinute = 0;
    for (const log of logs) {
      const t = new Date(log.createdAt).getTime();
      if (t >= startOfToday.getTime()) today += 1;
      if (now - t <= HOUR) lastHour += 1;
      if (now - t <= MIN) lastMinute += 1;
    }
    return { today, lastHour, lastMinute };
  }, [logs, now]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Kullanıcı Aktiviteleri</h1>
          <p className="mt-1 text-sm text-muted">
            Kullanıcı panelinde kimin ne zaman ne değiştirdiğinin kaydı — günlük, saatlik ve
            dakikalık özet ile birlikte.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={includeSelf}
            onChange={(e) => setIncludeSelf(e.target.checked)}
            className="h-4 w-4 rounded-sm border-border accent-primary"
          />
          Kendi işlemlerimi de göster
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Bugün" value={summary.today} icon={CalendarClock} />
        <StatCard label="Son 1 Saat" value={summary.lastHour} icon={Clock} />
        <StatCard label="Son 1 Dakika" value={summary.lastMinute} icon={Activity} />
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">İşlem Kayıtları</h2>
        </div>
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Henüz kullanıcı aktivitesi yok"
            description="Kullanıcılar stok güncellediğinde işlemler burada listelenecek."
          />
        ) : (
          <Table>
            <Thead>
              <Th>Tarih ve Saat</Th>
              <Th>Kullanıcı</Th>
              <Th>İşlem</Th>
              <Th>Kaynak</Th>
              <Th>Detay</Th>
            </Thead>
            <Tbody>
              {logs.map((log) => {
                let meta: Record<string, unknown> | null = null;
                try {
                  meta = log.meta ? JSON.parse(log.meta) : null;
                } catch {
                  meta = null;
                }
                return (
                  <Tr key={log.id}>
                    <Td className="text-muted">{formatDateTime(log.createdAt)}</Td>
                    <Td className="font-medium">{log.user?.name ?? 'Bilinmiyor'}</Td>
                    <Td>
                      <Badge tone={ACTION_TONE[log.action] ?? 'neutral'} withIcon={false}>
                        {ACTION_LABEL[log.action] ?? log.action}
                      </Badge>
                    </Td>
                    <Td className="text-muted">{RESOURCE_LABEL[log.resource] ?? log.resource}</Td>
                    <Td className="text-muted">
                      {meta && typeof meta.type === 'string' && typeof meta.quantity === 'number'
                        ? `${meta.type === 'OUT' ? '-' : '+'}${meta.quantity} adet`
                        : '—'}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
