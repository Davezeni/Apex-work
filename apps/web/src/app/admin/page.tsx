'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  ArrowLeft, Users, ShoppingBag, Briefcase, Package, Wallet as WalletIcon, Flag,
  ShieldOff, ShieldCheck, Loader2, CheckCircle, XCircle, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatEtb, timeAgo, cn } from '@/lib/utils';

type Tab = 'summary' | 'reports' | 'withdrawals' | 'users';

export default function AdminPage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>('summary');

  useEffect(() => {
    if (!isLoading && (!me || me.role !== 'ADMIN')) router.replace('/');
  }, [isLoading, me, router]);

  if (isLoading || !me) return <div className="grid min-h-dvh place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (me.role !== 'ADMIN') return null;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 py-3">
          <button onClick={() => router.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight">Admin</h1>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">STAFF</span>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-2">
          {(['summary', 'reports', 'withdrawals', 'users'] as Tab[]).map((t2) => (
            <button
              key={t2}
              onClick={() => setTab(t2)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold capitalize',
                tab === t2 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground',
              )}
            >
              {t2}
            </button>
          ))}
        </div>
      </header>

      {tab === 'summary' && <SummaryTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'withdrawals' && <WithdrawalsTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}

// ---------- SUMMARY ----------
interface Summary {
  users: { total: number; clients: number; freelancers: number };
  gigs: { total: number; active: number };
  jobs: { total: number; open: number };
  orders: { total: number; completed: number; active: number };
  gmvEtb: number;
  revenueEtb: number;
  pending: { reports: number; withdrawals: number };
}
function SummaryTab() {
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ['admin', 'summary'],
    queryFn: () => apiFetch('/admin/summary', { token }),
    enabled: !!token,
  });
  if (isLoading || !data) return <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="mx-3 mt-4 space-y-3">
      <div className="grad-hero rounded-2xl p-4 text-white shadow-xl shadow-primary/40">
        <div className="text-xs opacity-90">Platform revenue (all-time)</div>
        <div className="mt-1 text-3xl font-extrabold tracking-tight">{formatEtb(data.revenueEtb)}</div>
        <div className="mt-1 text-[11px] opacity-80">GMV {formatEtb(data.gmvEtb)}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <KPI icon={<Users className="h-4 w-4" />} label="Users" value={String(data.users.total)} sub={`${data.users.clients} clients · ${data.users.freelancers} pros`} />
        <KPI icon={<ShoppingBag className="h-4 w-4" />} label="Gigs" value={String(data.gigs.active)} sub={`${data.gigs.total} total`} />
        <KPI icon={<Briefcase className="h-4 w-4" />} label="Open jobs" value={String(data.jobs.open)} sub={`${data.jobs.total} total`} />
        <KPI icon={<Package className="h-4 w-4" />} label="Orders" value={String(data.orders.active)} sub={`${data.orders.completed} done`} />
        <KPI icon={<Flag className="h-4 w-4 text-red-500" />} label="Reports open" value={String(data.pending.reports)} sub="Needs review" />
        <KPI icon={<WalletIcon className="h-4 w-4 text-amber-500" />} label="Withdrawals" value={String(data.pending.withdrawals)} sub="Pending" />
      </div>
    </div>
  );
}
function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ---------- REPORTS ----------
interface Report {
  id: string; reason: string; targetType: string; targetId: string;
  details: string | null; status: string; createdAt: string;
  reporter: { id: string; username: string; fullName: string; avatarUrl: string | null };
}
function ReportsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const { data, isLoading } = useQuery<{ items: Report[] }>({
    queryKey: ['admin', 'reports', statusFilter],
    queryFn: () => apiFetch(`/admin/reports?status=${statusFilter}`, { token }),
    enabled: !!token,
  });
  const resolve = useMutation({
    mutationFn: (input: { id: string; action: 'REVIEWED' | 'DISMISSED' | 'ACTIONED' }) =>
      apiFetch(`/admin/reports/${input.id}/resolve`, { method: 'POST', token, body: { action: input.action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
  return (
    <div className="mx-3 mt-4">
      <div className="mb-2 flex gap-1">
        {['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn('rounded-full px-3 py-1 text-[11px] font-bold', statusFilter === s ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border')}>{s}</button>
        ))}
      </div>
      {isLoading && <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
      <div className="space-y-2">
        {(data?.items ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-red-500/10 text-red-500"><Flag className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{r.reason}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.reporter.fullName} · {r.targetType} {r.targetId.slice(0, 6)} · {timeAgo(r.createdAt)}
                </div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{r.status}</span>
            </div>
            {r.details && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.details}</p>}
            {r.status === 'OPEN' && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: r.id, action: 'DISMISSED' })} disabled={resolve.isPending}>
                  <XCircle className="h-3 w-3" /> Dismiss
                </Button>
                <Button size="sm" variant="destructive" onClick={() => resolve.mutate({ id: r.id, action: 'ACTIONED' })} disabled={resolve.isPending}>
                  <CheckCircle className="h-3 w-3" /> Action taken
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- WITHDRAWALS ----------
interface Withdrawal {
  id: string; amountEtb: number; feeEtb: number; netEtb: number;
  destination: string; accountNumber: string; accountName: string | null;
  status: string; createdAt: string; providerRef: string | null;
  user: { id: string; username: string; fullName: string; phone: string };
}
function WithdrawalsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const { data, isLoading } = useQuery<{ items: Withdrawal[] }>({
    queryKey: ['admin', 'withdrawals', statusFilter],
    queryFn: () => apiFetch(`/admin/withdrawals?status=${statusFilter}`, { token }),
    enabled: !!token,
  });
  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: 'PROCESSING' | 'SUCCESS' | 'FAILED'; providerRef?: string; failureReason?: string }) =>
      apiFetch(`/admin/withdrawals/${input.id}/status`, { method: 'POST', token, body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'withdrawals'] }),
  });
  const action = (w: Withdrawal, s: 'PROCESSING' | 'SUCCESS' | 'FAILED') => {
    let providerRef: string | undefined;
    let failureReason: string | undefined;
    if (s === 'SUCCESS') {
      providerRef = prompt('Provider reference (Chapa/Telebirr tx ID)?') || undefined;
    }
    if (s === 'FAILED') {
      failureReason = prompt('Why did this fail?') || undefined;
    }
    setStatus.mutate({ id: w.id, status: s, providerRef, failureReason }, {
      onSuccess: () => toast.success(`Marked ${s}`),
    });
  };
  return (
    <div className="mx-3 mt-4">
      <div className="mb-2 flex gap-1 overflow-x-auto">
        {['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn('shrink-0 rounded-full px-3 py-1 text-[11px] font-bold', statusFilter === s ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border')}>{s}</button>
        ))}
      </div>
      {isLoading && <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
      <div className="space-y-2">
        {(data?.items ?? []).map((w) => (
          <div key={w.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold">{formatEtb(w.amountEtb)}</div>
                <div className="text-[11px] text-muted-foreground">{w.user.fullName} · {w.user.phone}</div>
                <div className="text-[11px]">{w.destination} · {w.accountNumber}{w.accountName ? ` · ${w.accountName}` : ''}</div>
                <div className="text-[10px] text-muted-foreground">{timeAgo(w.createdAt)}{w.providerRef ? ` · ref ${w.providerRef}` : ''}</div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{w.status}</span>
            </div>
            {w.status === 'PENDING' && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => action(w, 'PROCESSING')} disabled={setStatus.isPending}>Processing</Button>
                <Button size="sm" variant="brand" onClick={() => action(w, 'SUCCESS')} disabled={setStatus.isPending}>Mark paid</Button>
                <Button size="sm" variant="destructive" onClick={() => action(w, 'FAILED')} disabled={setStatus.isPending}>Fail</Button>
              </div>
            )}
            {w.status === 'PROCESSING' && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="brand" onClick={() => action(w, 'SUCCESS')} disabled={setStatus.isPending}>Mark paid</Button>
                <Button size="sm" variant="destructive" onClick={() => action(w, 'FAILED')} disabled={setStatus.isPending}>Fail</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- USERS ----------
interface UserRow {
  id: string; username: string; fullName: string; phone: string; role: string;
  isPhoneVerified: boolean; isIdVerified: boolean; isActive: boolean;
  suspendedAt: string | null; rating: number; completedOrders: number; createdAt: string;
}
function UsersTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery<{ items: UserRow[] }>({
    queryKey: ['admin', 'users', q],
    queryFn: () => apiFetch(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token }),
    enabled: !!token,
  });
  const suspend = useMutation({
    mutationFn: (input: { id: string; suspend: boolean }) =>
      apiFetch(`/admin/users/${input.id}/suspend`, { method: 'POST', token, body: { suspend: input.suspend } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  return (
    <div className="mx-3 mt-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
      {isLoading && <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
      <div className="mt-3 space-y-2">
        {(data?.items ?? []).map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <Link href={`/u/${u.username}`} className="grad-hero grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white">
              {(u.fullName[0] ?? '?').toUpperCase()}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-semibold">
                {u.fullName}
                {u.isPhoneVerified && u.isIdVerified && <span className="text-cyan-500">✓</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">@{u.username} · {u.phone} · {u.role}</div>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', u.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500')}>
              {u.isActive ? 'active' : 'suspended'}
            </span>
            <Button size="sm" variant={u.isActive ? 'destructive' : 'brand'} onClick={() => suspend.mutate({ id: u.id, suspend: u.isActive })} disabled={suspend.isPending}>
              {u.isActive ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
