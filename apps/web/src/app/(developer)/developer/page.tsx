import Link from 'next/link';
import { AlertTriangle, Boxes, Building2, ScrollText, Users } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { serverFetch } from '@/lib/server-fetch';
import type { AuditLogEntry, Paginated, Warehouse } from '@/lib/types';
import type { PublicUser } from '@repo/shared-types';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DeveloperHomePage() {
  const [users, warehouses, logs] = await Promise.all([
    serverFetch<PublicUser[]>('/users'),
    serverFetch<Warehouse[]>('/warehouses'),
    serverFetch<Paginated<AuditLogEntry>>('/audit-logs?limit=8'),
  ]);

  const activeUsers = users.filter((u) => u.isActive).length;
  const totalProducts = warehouses.reduce((sum, w) => sum + w.productCount, 0);
  const totalCritical = warehouses.reduce((sum, w) => sum + w.criticalCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Genel Bakış</h1>
        <p className="mt-1 text-sm text-muted">Tüm depoların, kullanıcıların ve aktivitenin özeti.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Link href="/developer/warehouses">
          <StatCard label="Depo Sayısı" value={warehouses.length} icon={Building2} />
        </Link>
        <StatCard label="Aktif Kullanıcı" value={activeUsers} icon={Users} />
        <StatCard label="Toplam Ürün (tüm depolar)" value={totalProducts} icon={Boxes} />
        <StatCard
          label="Kritik Stok (tüm depolar)"
          value={totalCritical}
          icon={AlertTriangle}
          tone={totalCritical > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Depolar</h2>
          <Link href="/developer/warehouses" className="text-xs text-accent hover:underline">
            Tümünü gör
          </Link>
        </div>
        {warehouses.length === 0 ? (
          <EmptyState icon={Building2} title="Henüz depo yok" />
        ) : (
          <Table>
            <Thead>
              <Th>Depo</Th>
              <Th>Ürün</Th>
              <Th>Kritik</Th>
              <Th>Kullanıcı</Th>
            </Thead>
            <Tbody>
              {warehouses.map((w) => (
                <Tr key={w.id}>
                  <Td className="font-medium">
                    <Link href={`/developer/warehouses/${w.id}`} className="hover:text-accent">
                      {w.name}
                    </Link>
                  </Td>
                  <Td>{w.productCount}</Td>
                  <Td className={w.criticalCount > 0 ? 'text-warning' : 'text-muted'}>
                    {w.criticalCount}
                  </Td>
                  <Td>{w.userCount}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Son Aktiviteler</h2>
        </div>
        {logs.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="Henüz aktivite kaydı yok" />
        ) : (
          <Table>
            <Thead>
              <Th>Tarih</Th>
              <Th>Kullanıcı</Th>
              <Th>İşlem</Th>
              <Th>Kaynak</Th>
            </Thead>
            <Tbody>
              {logs.items.map((log) => (
                <Tr key={log.id}>
                  <Td className="text-muted">{formatDateTime(log.createdAt)}</Td>
                  <Td>{log.user?.name ?? 'Sistem'}</Td>
                  <Td className="font-mono text-xs">{log.action}</Td>
                  <Td className="text-muted">{log.resource}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
