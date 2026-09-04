'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { formatEtb, cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls, Field } from './admin-ui';
import { ExportButton } from './export-button';

type Sub = 'orders' | 'ledger' | 'withdrawals' | 'reconcile' | 'health';

const orderTone: Record<string, 'ok' | 'warn' | 'neutral' | 'bad' | 'info'> = {
  COMPLETED: 'ok', ACTIVE: 'info', IN_REVIEW: 'warn', DELIVERED: 'ok', PENDING: 'neutral', CANCELLED: 'bad', DISPUTED: 'bad',
};

export function MoneyTab() {
  const [sub, setSub] = useState<Sub>('orders');
  return (
    <div className="space-y-5">
      <SectionHead title="Orders & Money" subtitle="Orders, refunds, wallet ledger and payouts" />
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(['orders', 'ledger', 'withdrawals', 'reconcile', 'health'] as Sub[]).map((s) => (
          <button key={s} onClick={() => setSub(s)} className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-bold capitalize transition-colors', sub === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>{s}</button>
        ))}
      </div>
      {sub === 'orders' && <Orders />}
      {sub === 'ledger' && <Ledger />}
      {sub === 'withdrawals' && <Withdrawals />}
      {sub === 'reconcile' && <Reconcile />}
      {sub === 'health' && <OrderHealth />}
    </div>
  );
}

function useToken() { return useAuthStore((s) => s.accessToken); }

function Orders() {
  const token = useToken();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [refund, setRefund] = useState<{ id: string; title: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/orders', status, q],
    queryFn: () => apiFetch(`/admin/ops/orders?limit=25${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { token }),
  });
  const refundMut = useMutation({
    mutationFn: () => apiFetch(`/admin/ops/orders/${refund!.id}/refund`, { method: 'POST', token, body: { amountEtb: Number(amount), reason } }),
    onSuccess: () => { toast.success('Refund issued'); setRefund(null); setAmount(''); setReason(''); qc.invalidateQueries({ queryKey: ['admin/orders'] }); qc.invalidateQueries({ queryKey: ['admin/ledger'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inputCls, 'w-auto')}>
          <option value="">All statuses</option>
          {Object.keys(orderTone).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title / order #" className={cn(inputCls, 'w-64')} />
        <ExportButton kind="orders" params={{ status: status || undefined, q: q || undefined }} />
      </div>
      {isLoading ? <Spinner label="Loading orders…" /> : items.length === 0 ? <Empty message="No orders found" /> : (
        <TableShell>
          <thead><tr><Th>Order</Th><Th>Client</Th><Th>Seller</Th><Th>Amount</Th><Th>Status</Th><Th>Refund</Th></tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-b border-border/50">
                <Td><div className="truncate font-bold">{o.title}</div><div className="text-[11px] text-muted-foreground">{o.orderNumber}</div></Td>
                <Td className="text-muted-foreground">@{o.client?.username}</Td>
                <Td className="text-muted-foreground">@{o.seller?.username}</Td>
                <Td className="font-semibold">{formatEtb(o.amountEtb)}</Td>
                <Td><Badge tone={orderTone[o.status] ?? 'neutral'}>{o.status}</Badge></Td>
                <Td><Button size="sm" variant="outline" disabled={o.status === 'CANCELLED'} onClick={() => setRefund({ id: o.id, title: o.title })}>Refund</Button></Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {refund && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setRefund(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold">Refund order</h3>
            <p className="text-xs text-muted-foreground">{refund.title}</p>
            <Field label="Amount (ETB)"><input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
            <Field label="Reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputCls} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRefund(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" disabled={!amount || !reason || refundMut.isPending} onClick={() => refundMut.mutate()}>{refundMut.isPending ? 'Refunding…' : 'Issue refund'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Ledger() {
  const token = useToken();
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [adj, setAdj] = useState(false);
  const [amt, setAmt] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<'MANUAL_CREDIT' | 'MANUAL_DEBIT'>('MANUAL_CREDIT');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/ledger', userId],
    queryFn: () => apiFetch(`/admin/ops/ledger?limit=30${userId ? `&userId=${userId}` : ''}`, { token }),
  });
  const adjust = useMutation({
    mutationFn: () => apiFetch(`/admin/ops/wallet/${userId}/adjust`, { method: 'POST', token, body: { type, amountEtb: Number(amt), description: desc } }),
    onSuccess: () => { toast.success('Wallet adjusted'); setAdj(false); setAmt(''); setDesc(''); qc.invalidateQueries({ queryKey: ['admin/ledger'] }); qc.invalidateQueries({ queryKey: ['admin/users'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="User id (filter)"><input value={userId} onChange={(e) => setUserId(e.target.value)} className={cn(inputCls, 'w-56')} /></Field>
        <Button size="sm" variant="brand" onClick={() => setAdj((v) => !v)}>{adj ? 'Close' : 'Adjust wallet'}</Button>
      </div>
      {adj && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as never)} className={cn(inputCls, 'w-auto')}>
              <option value="MANUAL_CREDIT">Credit (+)</option>
              <option value="MANUAL_DEBIT">Debit (−)</option>
            </select>
            <input type="number" min={1} placeholder="Amount ETB" value={amt} onChange={(e) => setAmt(e.target.value)} className={cn(inputCls, 'w-40')} />
          </div>
          <input placeholder="Reason (required, audited)" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} />
          <Button size="sm" variant="brand" disabled={!userId || !amt || !desc || adjust.isPending} onClick={() => adjust.mutate()}>{adjust.isPending ? 'Saving…' : 'Apply adjustment'}</Button>
        </div>
      )}
      {isLoading ? <Spinner label="Loading ledger…" /> : items.length === 0 ? <Empty message="No ledger entries" /> : (
        <TableShell>
          <thead><tr><Th>User</Th><Th>Type</Th><Th>Amount</Th><Th>Description</Th><Th>When</Th></tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-b border-border/50">
                <Td className="text-muted-foreground">@{t.user?.username}</Td>
                <Td><Badge tone="info">{t.type}</Badge></Td>
                <Td className={cn('font-semibold', t.amountEtb >= 0 ? 'text-emerald-600' : 'text-red-600')}>{t.amountEtb >= 0 ? '+' : ''}{formatEtb(t.amountEtb)}</Td>
                <Td className="max-w-[280px]"><span className="line-clamp-2">{t.description}</span></Td>
                <Td className="text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}

function Withdrawals() {
  const token = useToken();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/withdrawals-ops', status],
    queryFn: () => apiFetch(`/admin/ops/withdrawals?limit=25${status ? `&status=${status}` : ''}`, { token }),
  });
  const act = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      apiFetch(`/admin/ops/withdrawals/${vars.id}/status`, { method: 'POST', token, body: { status: vars.status } }),
    onSuccess: () => { toast.success('Withdrawal updated'); qc.invalidateQueries({ queryKey: ['admin/withdrawals-ops'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const items: any[] = data?.items ?? [];
  const tone: Record<string, 'ok' | 'warn' | 'neutral' | 'bad'> = { SUCCESS: 'ok', PROCESSING: 'warn', PENDING: 'neutral', FAILED: 'bad', CANCELLED: 'neutral' };
  return (
    <div className="space-y-3">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inputCls, 'w-auto')}>
        <option value="">All</option>
        {Object.keys(tone).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {isLoading ? <Spinner label="Loading withdrawals…" /> : items.length === 0 ? <Empty message="No withdrawals" /> : (
        <TableShell>
          <thead><tr><Th>User</Th><Th>Amount</Th><Th>Destination</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id} className="border-b border-border/50">
                <Td className="text-muted-foreground">@{w.user?.username}</Td>
                <Td className="font-semibold">{formatEtb(w.netEtb)}</Td>
                <Td className="text-muted-foreground">{w.destination}</Td>
                <Td><Badge tone={tone[w.status] ?? 'neutral'}>{w.status}</Badge></Td>
                <Td>
                  {w.status === 'PENDING' && <Button size="sm" variant="brand" disabled={act.isPending} onClick={() => act.mutate({ id: w.id, status: 'PROCESSING' })}>Process</Button>}
                  {w.status === 'PROCESSING' && <>
                    <Button size="sm" variant="brand" disabled={act.isPending} onClick={() => act.mutate({ id: w.id, status: 'SUCCESS' })}>Mark success</Button>
                    <Button size="sm" variant="destructive" disabled={act.isPending} onClick={() => act.mutate({ id: w.id, status: 'FAILED' })}>Fail</Button>
                  </>}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}

interface ReconRow { userId: string; walletBalanceEtb: number; ledgerEtb: number; driftEtb: number; matches: boolean }
function Reconcile() {
  const token = useToken();
  const { data, isLoading, refetch } = useQuery<{ wallets: number; reconciled: number; drifted: number; netDriftEtb: number; rows: ReconRow[] }>({
    queryKey: ['admin/reconcile'],
    queryFn: () => apiFetch('/admin/ops/reconcile', { token }),
    enabled: !!token,
  });
  const drifts = (data?.rows ?? []).filter((r) => !r.matches);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Verifies every wallet balance equals the signed sum of its ledger transactions.</p>
        <button onClick={() => refetch()} disabled={isLoading} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-50">Recheck</button>
      </div>
      {isLoading ? <Spinner label="Reconciling…" /> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Mini tx={data?.wallets ?? 0} label="Wallets" />
            <Mini tx={data?.reconciled ?? 0} label="In sync" />
            <Mini tx={data?.drifted ?? 0} label="Drifted" warn={(data?.drifted ?? 0) > 0} />
          </div>
          {data && data.netDriftEtb !== 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600">Net ledger vs wallet drift: {formatEtb(data.netDriftEtb)}</div>
          )}
          {drifts.length === 0 ? <Empty message="All wallets reconcile ✓" /> : (
            <TableShell>
              <thead><tr><Th>User</Th><Th>Wallet</Th><Th>Ledger</Th><Th>Drift</Th></tr></thead>
              <tbody>
                {drifts.slice(0, 100).map((r) => (
                  <tr key={r.userId} className="border-b border-border/50">
                    <Td className="text-muted-foreground">@{r.userId.slice(0, 8)}…</Td>
                    <Td className="font-semibold">{formatEtb(r.walletBalanceEtb)}</Td>
                    <Td className="font-semibold">{formatEtb(r.ledgerEtb)}</Td>
                    <Td><Badge tone="bad">{formatEtb(r.driftEtb)}</Badge></Td>
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
function Mini({ tx, label, warn }: { tx: number; label: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-3 ${warn ? 'border-amber-500/40' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{tx.toLocaleString()}</div>
    </div>
  );
}

// ---------- ORDER HEALTH ----------
interface HealthItem {
  orderId: string; orderNumber: string; title: string; status: string; amountEtb: number;
  clientName: string; sellerName: string; category: string; severity: 'high' | 'medium' | 'low';
  ageDays: number; note: string;
}
interface HealthResp {
  total: number; high: number; medium: number; low: number;
  counts: Record<string, number>;
  inbox: HealthItem[];
}
const severityTone: Record<string, 'bad' | 'warn' | 'neutral'> = { high: 'bad', medium: 'warn', low: 'neutral' };
const catLabel: Record<string, string> = {
  OVERDUE_DELIVERY: 'Overdue delivery',
  STALE_DISPUTE: 'Stale dispute',
  STALE_REVIEW: 'Stale review',
  UNRESOLVED_ORDER: 'Unresolved order',
  ABANDONED_ORDER: 'Abandoned order',
};
function OrderHealth() {
  const token = useToken();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<HealthResp>({
    queryKey: ['admin/order-health'],
    queryFn: () => apiFetch('/admin/ops/order-health?limit=30', { token }),
    enabled: !!token,
  });
  const digest = useMutation({
    mutationFn: () => apiFetch('/admin/ops/order-health/digest', { method: 'POST', token }),
    onSuccess: (r: any) => {
      toast.success(`Digest queued for ${r.recipients?.length ?? 0} staff member(s)`);
      qc.invalidateQueries({ queryKey: ['admin/order-health'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Orders breaching an SLA or stuck in the flow. Highest severity first.</p>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => refetch()} disabled={isLoading} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-50">Refresh</button>
          <button onClick={() => digest.mutate()} disabled={digest.isPending} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Send daily digest</button>
        </div>
      </div>
      {isLoading ? <Spinner label="Checking order health…" /> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Mini tx={data?.total ?? 0} label="Attention" warn={(data?.total ?? 0) > 0} />
            <Mini tx={data?.high ?? 0} label="High" warn={(data?.high ?? 0) > 0} />
            <Mini tx={(data?.medium ?? 0) + (data?.low ?? 0)} label="Med + Low" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data?.counts ?? {}).map(([k, v]) => (
              <span key={k} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                {catLabel[k] ?? k}: {v}
              </span>
            ))}
          </div>
          {(data?.inbox ?? []).length === 0 ? <Empty message="No orders currently need attention ✓" /> : (
            <TableShell>
              <thead><tr><Th>Order</Th><Th>Issue</Th><Th>Parties</Th><Th>Amount</Th><Th>Age</Th></tr></thead>
              <tbody>
                {(data?.inbox ?? []).map((it) => (
                  <tr key={it.orderId} className="border-b border-border/50">
                    <Td>
                      <div className="font-semibold">{it.orderNumber}</div>
                      <div className="text-[10px] text-muted-foreground">{it.title}</div>
                    </Td>
                    <Td>
                      <Badge tone={severityTone[it.severity]}>{catLabel[it.category] ?? it.category}</Badge>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{it.note}</div>
                    </Td>
                    <Td className="text-[11px] text-muted-foreground">
                      <div>{it.clientName} → {it.sellerName}</div>
                    </Td>
                    <Td className="font-semibold">{formatEtb(it.amountEtb)}</Td>
                    <Td className="text-[11px] text-muted-foreground">{it.ageDays}d</Td>
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
