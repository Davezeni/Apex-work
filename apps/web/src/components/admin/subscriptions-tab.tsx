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
  const [view, setView] = useState<'list' | 'revenue'>('list');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/subscriptions', status],
    queryFn: () => apiFetch(`/admin/ops/subscriptions?limit=30${status ? `&status=${status}` : ''}`, { token }),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-4">
      <SectionHead title="Subscriptions" subtitle="Pro passes & monetization" actions={
        <div className="flex gap-1">
          {(['list', 'revenue'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn('rounded-full px-3 py-1 text-[11px] font-bold capitalize', view === v ? 'bg-primary text-white' : 'border border-border text-muted-foreground')}>{v}</button>
          ))}
        </div>
      } />
      {view === 'revenue' ? <RevenueView token={token} /> : (
        <>
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
        </>
      )}
    </div>
  );
}

interface RevData {
  windowDays: number;
  stats: {
    activeSubscribers: number; activeRevenueEtb: number; totalRevenueEtb: number;
    lastWindowRevenueEtb: number; lastWindowPurchases: number; avgPriceEtb: number;
    byPlan: { plan: string; count: number; active: number; revenueEtb: number; sharePct: number }[];
    topPlan: { plan: string; revenueEtb: number } | null;
  };
}
function RevenueView({ token }: { token: string | null }) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery<RevData>({
    queryKey: ['admin/subscriptions/analytics', days],
    queryFn: () => apiFetch<RevData>(`/admin/ops/subscriptions/analytics?days=${days}`, { token }),
    enabled: !!token,
  });
  const s = data?.stats;
  if (isLoading || !s) return <Spinner label="Loading revenue…" />;
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={cn('rounded-full px-3 py-1 text-[11px] font-bold', days === d ? 'bg-primary text-white' : 'border border-border text-muted-foreground')}>{d}d</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RevStat label="Pro subs" value={String(s.activeSubscribers)} />
        <RevStat label="Active value" value={formatEtb(s.activeRevenueEtb)} />
        <RevStat label="Avg price" value={formatEtb(s.avgPriceEtb)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RevStat label={`Revenue (${data!.windowDays}d)`} value={formatEtb(s.lastWindowRevenueEtb)} />
        <RevStat label="Purchases" value={String(s.lastWindowPurchases)} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total revenue · {formatEtb(s.totalRevenueEtb)}</div>
        <div className="mt-2 space-y-2">
          {s.byPlan.map((p) => (
            <div key={p.plan} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{p.plan}</span>
                <span className="text-muted-foreground">{p.sharePct}% · {formatEtb(p.revenueEtb)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${p.sharePct}%` }} />
              </div>
            </div>
          ))}
          {s.byPlan.length === 0 && <div className="text-xs text-muted-foreground">No paid subscriptions yet.</div>}
        </div>
      </div>
    </div>
  );
}
function RevStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
