'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { formatEtb, cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';
const subTone: Record<string, 'ok' | 'warn' | 'neutral' | 'bad'> = {
  ACTIVE: 'ok',
  PENDING: 'warn',
  EXPIRED: 'neutral',
  CANCELLED: 'bad',
};

export function SubscriptionsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'list' | 'revenue' | 'roi'>('list');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/subscriptions', status],
    queryFn: () =>
      apiFetch(`/admin/ops/subscriptions?limit=30${status ? `&status=${status}` : ''}`, { token }),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-4">
      <SectionHead
        title={dt('Subscriptions')}
        subtitle={dt('Pro passes & monetization')}
        actions={
          <div className="flex gap-1">
            {(['list', 'revenue', 'roi'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-bold capitalize',
                  view === v
                    ? 'bg-primary text-white'
                    : 'border border-border text-muted-foreground',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />
      {view === 'revenue' ? (
        <RevenueView token={token} />
      ) : view === 'roi' ? (
        <RoiView token={token} />
      ) : (
        <>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(inputCls, 'w-auto')}
          >
            <option value="">{dt('All plans')}</option>
            {Object.keys(subTone).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {isLoading ? (
            <Spinner label={dt('Loading…')} />
          ) : items.length === 0 ? (
            <Empty message="No subscriptions" />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>{dt('User')}</Th>
                  <Th>{dt('Plan')}</Th>
                  <Th>{dt('Amount')}</Th>
                  <Th>{dt('Status')}</Th>
                  <Th>{dt('Expires')}</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <Td className="text-muted-foreground">@{s.user?.username}</Td>
                    <Td>
                      <Badge tone="info">{s.plan}</Badge>
                    </Td>
                    <Td className="font-semibold">{formatEtb(s.amountEtb)}</Td>
                    <Td>
                      <Badge tone={subTone[s.status] ?? 'neutral'}>{s.status}</Badge>
                    </Td>
                    <Td className="text-muted-foreground">
                      {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : '—'}
                    </Td>
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
    activeSubscribers: number;
    activeRevenueEtb: number;
    totalRevenueEtb: number;
    lastWindowRevenueEtb: number;
    lastWindowPurchases: number;
    avgPriceEtb: number;
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
  if (isLoading || !s) return <Spinner label={dt('Loading revenue…')} />;
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-bold',
              days === d ? 'bg-primary text-white' : 'border border-border text-muted-foreground',
            )}
          >
            {d}d
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RevStat label={dt('Pro subs')} value={String(s.activeSubscribers)} />
        <RevStat label={dt('Active value')} value={formatEtb(s.activeRevenueEtb)} />
        <RevStat label={dt('Avg price')} value={formatEtb(s.avgPriceEtb)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RevStat
          label={`Revenue (${data!.windowDays}d)`}
          value={formatEtb(s.lastWindowRevenueEtb)}
        />
        <RevStat label={dt('Purchases')} value={String(s.lastWindowPurchases)} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Total revenue · {formatEtb(s.totalRevenueEtb)}
        </div>
        <div className="mt-2 space-y-2">
          {s.byPlan.map((p) => (
            <div key={p.plan} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{p.plan}</span>
                <span className="text-muted-foreground">
                  {p.sharePct}% · {formatEtb(p.revenueEtb)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${p.sharePct}%` }}
                />
              </div>
            </div>
          ))}
          {s.byPlan.length === 0 && (
            <div className="text-xs text-muted-foreground">{dt('No paid subscriptions yet.')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
function RevStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

interface RoiRow {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  costEtb: number;
  valueEtb: number;
  purchases: number;
  lastStatus: string;
  netEtb: number;
  roiMultiple: number;
  profitable: boolean;
}
interface RoiData {
  subscribers: number;
  totalCostEtb: number;
  totalValueEtb: number;
  netEtb: number;
  roiMultiple: number;
  repurchaseRate: number;
  profitableCount: number;
  profitablePct: number;
  avgRoi: number;
  topRoi: RoiRow[];
  worstRoi: RoiRow[];
}
function RoiView({ token }: { token: string | null }) {
  const { data, isLoading } = useQuery<RoiData>({
    queryKey: ['admin/subscriptions/roi'],
    queryFn: () => apiFetch<RoiData>('/admin/ops/subscriptions/roi?limit=6', { token }),
    enabled: !!token,
  });
  if (isLoading || !data) return <Spinner label={dt('Loading ROI…')} />;
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const roiLabel = (m: number) => `${m.toFixed(2)}×`;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <RoiCell
            label={dt('ROI')}
            value={roiLabel(data.roiMultiple)}
            big
            tone={data.roiMultiple >= 1}
          />
          <RoiCell label={dt('Net value')} value={formatEtb(data.netEtb)} tone={data.netEtb > 0} />
          <RoiCell label={dt('Subscribers')} value={String(data.subscribers)} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/50 p-2 text-[11px]">
            <span className="text-muted-foreground">{dt('Invested ')}</span>
            <b>{formatEtb(data.totalCostEtb)}</b> ·{' '}
            <span className="text-muted-foreground">{dt('Returned ')}</span>
            <b>{formatEtb(data.totalValueEtb)}</b>
          </div>
          <div className="rounded-xl bg-muted/50 p-2 text-[11px]">
            <span className="text-muted-foreground">{dt('Avg ROI ')}</span>
            <b>{roiLabel(data.avgRoi)}</b> ·{' '}
            <span className="text-muted-foreground">{dt('Repeat ')}</span>
            <b>{pct(data.repurchaseRate)}</b>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          {data.profitableCount}/{data.subscribers} profitable ({pct(data.profitablePct)}) · Pro
          pass pays for itself when freelancer earnings / client spend exceeds its cost.
        </div>
      </div>
      {data.topRoi.length > 0 && <RoiTable title={dt('Best ROI')} rows={data.topRoi} />}
      {data.worstRoi.length > 0 && <RoiTable title={dt('Lowest ROI')} rows={data.worstRoi} />}
    </div>
  );
}
function RoiCell({
  label,
  value,
  big,
  tone,
}: {
  label: string;
  value: string;
  big?: boolean;
  tone?: boolean;
}) {
  return (
    <div>
      <div
        className={`${big ? 'text-2xl' : 'text-xl'} font-extrabold tracking-tight ${tone ? 'text-emerald-600' : ''}`}
      >
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
function RoiTable({ title, rows }: { title: string; rows: RoiRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="mt-2 space-y-2">
        {rows.map((r) => (
          <div key={r.userId} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.fullName}</div>
              <div className="text-[10px] text-muted-foreground">
                @{r.username} · {r.role} · cost {formatEtb(r.costEtb)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={`text-sm font-extrabold ${r.profitable ? 'text-emerald-600' : 'text-red-500'}`}
              >
                {r.roiMultiple.toFixed(2)}×
              </div>
              <div className="text-[10px] text-muted-foreground">
                {r.netEtb >= 0 ? '+' : ''}
                {formatEtb(r.netEtb)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
