'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { formatEtb, cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';

const subTone: Record<string, 'ok' | 'warn' | 'neutral' | 'bad'> = {
  ACTIVE: 'ok', PENDING: 'warn', EXPIRED: 'neutral', CANCELLED: 'bad',
};

export function SubscriptionsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/subscriptions', status],
    queryFn: () => apiFetch(`/admin/ops/subscriptions?limit=30${status ? `&status=${status}` : ''}`, { token }),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-4">
      <SectionHead title="Subscriptions" subtitle="Pro passes & monetization" />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inputCls, 'w-auto')}>
        <option value="">All plans</option>
        {Object.keys(subTone).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {isLoading ? <Spinner label="Loading…" /> : items.length === 0 ? <Empty message="No subscriptions" /> : (
        <TableShell>
          <thead><tr><Th>User</Th><Th>Plan</Th><Th>Amount</Th><Th>Status</Th><Th>Expires</Th></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-b border-border/50">
                <Td className="text-muted-foreground">@{s.user?.username}</Td>
                <Td><Badge tone="info">{s.plan}</Badge></Td>
                <Td className="font-semibold">{formatEtb(s.amountEtb)}</Td>
                <Td><Badge tone={subTone[s.status] ?? 'neutral'}>{s.status}</Badge></Td>
                <Td className="text-muted-foreground">{s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
