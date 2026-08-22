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

type Tab = 'summary' | 'reports' | 'withdrawals' | 'users' | 'certs' | 'disputes' | 'diagnostics';

export default function AdminPage() {
  const router = useRouter();
  const { data: me, isLoading, isAuthed } = useMe();
  const [tab, setTab] = useState<Tab>('summary');

  useEffect(() => {
    // Only redirect once we know for sure:
    //   • user is signed OUT → send to login (preserving return path)
    //   • user is signed in AND we've fetched their profile AND role isn't ADMIN → home
    // Anything else (still loading) → wait.
    if (isLoading) return;
    if (!isAuthed) {
      router.replace('/login?next=/admin');
      return;
    }
    if (me && me.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [isLoading, isAuthed, me, router]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (me.role !== 'ADMIN') {
    // Show a friendly explanation while the redirect happens — beats a blank screen.
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div>
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-extrabold">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account role is <b>{me.role}</b>. Sign out and back in if you
            were just promoted — the role is cached in your session token.
          </p>
          <Button asChild variant="brand" size="sm" className="mt-4">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

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
          {(['summary', 'reports', 'disputes', 'withdrawals', 'users', 'certs', 'diagnostics'] as Tab[]).map((t2) => (
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
      {tab === 'disputes' && <DisputesTab />}
      {tab === 'withdrawals' && <WithdrawalsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'certs' && <CertsTab />}
      {tab === 'diagnostics' && <DiagnosticsTab />}
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

// ---------- CERTIFICATIONS ----------
interface CertRow {
  id: string; name: string; issuer: string; issueYear: number; issueMonth: number | null;
  credentialUrl: string | null; verifiedAt: string | null;
  resume: { user: { id: string; username: string; fullName: string; avatarUrl: string | null } };
}
function CertsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [unverifiedOnly, setUnverifiedOnly] = useState(true);
  const { data, isLoading } = useQuery<{ items: CertRow[] }>({
    queryKey: ['admin', 'certs', unverifiedOnly],
    queryFn: () => apiFetch(`/admin/certifications${unverifiedOnly ? '?unverified=1' : ''}`, { token }),
    enabled: !!token,
  });
  const verify = useMutation({
    mutationFn: (input: { id: string; verify: boolean }) =>
      apiFetch(`/admin/certifications/${input.id}/verify`, { method: 'POST', token, body: { verify: input.verify } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'certs'] }),
  });
  return (
    <div className="mx-3 mt-4">
      <div className="mb-2 flex gap-1">
        <button onClick={() => setUnverifiedOnly(true)} className={cn('rounded-full px-3 py-1 text-[11px] font-bold', unverifiedOnly ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border')}>Unverified</button>
        <button onClick={() => setUnverifiedOnly(false)} className={cn('rounded-full px-3 py-1 text-[11px] font-bold', !unverifiedOnly ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border')}>All</button>
      </div>
      {isLoading && <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
      <div className="space-y-2">
        {(data?.items ?? []).map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <Link href={`/u/${c.resume.user.username}`} className="grad-hero grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
                {(c.resume.user.fullName[0] ?? '?').toUpperCase()}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.issuer} · {c.issueYear}</div>
                <div className="text-[10px] text-muted-foreground">by <Link href={`/u/${c.resume.user.username}`} className="underline">{c.resume.user.fullName}</Link></div>
                {c.credentialUrl && (
                  <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-bold text-primary underline">
                    Open credential →
                  </a>
                )}
              </div>
              {c.verifiedAt ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">VERIFIED</span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">UNVERIFIED</span>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              {c.verifiedAt ? (
                <Button size="sm" variant="outline" onClick={() => verify.mutate({ id: c.id, verify: false })} disabled={verify.isPending}>
                  Un-verify
                </Button>
              ) : (
                <Button size="sm" variant="brand" onClick={() => verify.mutate({ id: c.id, verify: true })} disabled={verify.isPending}>
                  <CheckCircle className="h-3 w-3" /> Verify
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- DISPUTES ----------
import { useAdminDisputes, useResolveDispute, type Dispute } from '@/hooks/use-disputes';
import { AlertTriangle } from 'lucide-react';

function DisputesTab() {
  const [status, setStatus] = useState<string>('OPEN');
  const { data, isLoading } = useAdminDisputes(status);
  const resolve = useResolveDispute();

  const decide = (d: Dispute, ruling: 'RESOLVED_CLIENT' | 'RESOLVED_SELLER' | 'RESOLVED_SPLIT' | 'WITHDRAWN') => {
    let clientPayoutEtb: number | undefined;
    let sellerPayoutEtb: number | undefined;
    let adminNotes = '';
    if (ruling === 'RESOLVED_SPLIT') {
      const c = Number(window.prompt('Client refund (ETB)', String(Math.floor((d.order?.amountEtb ?? 0) / 2))));
      if (Number.isNaN(c)) return;
      clientPayoutEtb = c;
      sellerPayoutEtb = (d.order?.amountEtb ?? 0) - c;
    }
    adminNotes = window.prompt('Optional notes for the ruling') ?? '';
    if (!window.confirm(`Confirm ${ruling}?`)) return;
    resolve.mutate({ id: d.id, ruling, clientPayoutEtb, sellerPayoutEtb, adminNotes: adminNotes || undefined }, {
      onSuccess: () => toast.success('Dispute resolved'),
      onError: (e) => toast.error(e.message ?? 'Failed'),
    });
  };

  return (
    <div className="mx-3 mt-4">
      <div className="mb-2 flex gap-1 overflow-x-auto">
        {['OPEN', 'REVIEWING', 'RESOLVED_CLIENT', 'RESOLVED_SELLER', 'RESOLVED_SPLIT', 'WITHDRAWN'].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn('shrink-0 rounded-full px-3 py-1 text-[11px] font-bold', status === s ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border')}>{s}</button>
        ))}
      </div>
      {isLoading && <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
      <div className="space-y-2">
        {(data?.items ?? []).map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-500"><AlertTriangle className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{d.order?.title ?? 'Order'} · {formatEtb(d.order?.amountEtb ?? 0)}</div>
                <div className="text-[11px] text-muted-foreground">
                  opened by {d.openedBy?.fullName} · {timeAgo(d.createdAt)}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs">{d.reason}</p>
                {d.order && (
                  <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                    <Link className="hover:underline" href={`/u/${d.order.client.username}`}>client @{d.order.client.username}</Link>
                    <Link className="hover:underline" href={`/u/${d.order.seller.username}`}>seller @{d.order.seller.username}</Link>
                    <Link className="hover:underline text-primary" href={`/orders/${d.order.id}`}>view order →</Link>
                  </div>
                )}
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{d.status}</span>
            </div>
            {(d.status === 'OPEN' || d.status === 'REVIEWING') && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="destructive" onClick={() => decide(d, 'RESOLVED_CLIENT')} disabled={resolve.isPending}>Refund client</Button>
                <Button size="sm" variant="brand" onClick={() => decide(d, 'RESOLVED_SELLER')} disabled={resolve.isPending}>Release to seller</Button>
                <Button size="sm" variant="outline" onClick={() => decide(d, 'RESOLVED_SPLIT')} disabled={resolve.isPending}>Split…</Button>
                <Button size="sm" variant="outline" onClick={() => decide(d, 'WITHDRAWN')} disabled={resolve.isPending}>Withdrawn</Button>
              </div>
            )}
            {d.status.startsWith('RESOLVED_') && d.clientPayoutEtb != null && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Split: client {formatEtb(d.clientPayoutEtb)} / seller {formatEtb(d.sellerPayoutEtb ?? 0)}
              </div>
            )}
            {d.adminNotes && (
              <p className="mt-1 whitespace-pre-wrap text-[11px] italic text-muted-foreground">Notes: {d.adminNotes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- DIAGNOSTICS ----------
interface Diagnostics {
  services: {
    supabase: boolean;
    chapa: boolean;
    groq: boolean;
    resend: boolean;
    vapidPush: boolean;
    turn: {
      hasKey: boolean;
      appName: string;
      cachedAt: string | null;
      cachedServerCount: number;
      lastError: { at: string; message: string; url: string } | null;
    };
    cronToken: boolean;
    afromessage: boolean;
  };
  ts: string;
}
function DiagnosticsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<Diagnostics>({
    queryKey: ['admin', 'diagnostics'],
    queryFn: () => apiFetch('/admin/diagnostics', { token }),
    enabled: !!token,
    refetchInterval: 5000,
  });
  const refreshTurn = useMutation({
    mutationFn: () => apiFetch<{ servers: unknown[]; debug: unknown }>('/admin/turn/refresh', { method: 'POST', token }),
    onSuccess: () => {
      toast.success('TURN cache cleared + re-fetched');
      qc.invalidateQueries({ queryKey: ['admin', 'diagnostics'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Failed'),
  });
  const testEmail = useMutation({
    mutationFn: (to?: string) => apiFetch<{ queued: string; to: string }>('/admin/email/test', {
      method: 'POST', token, body: to ? { to } : {},
    }),
    onSuccess: (r) => toast.success(`Test email queued to ${r.to} — check inbox in ~10s`),
    onError: (e) => toast.error((e as Error).message ?? 'Failed'),
  });

  const sendTestEmail = () => {
    const to = window.prompt('Send test to which email? (blank = your admin email)') ?? undefined;
    testEmail.mutate(to || undefined);
  };

  if (isLoading || !data) return <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />;
  const s = data.services;

  return (
    <div className="mx-3 mt-4 space-y-2">
      <StatusRow label="Supabase Storage" ok={s.supabase} note="uploads, avatars, chat attachments" />
      <StatusRow label="Chapa payments"  ok={s.chapa} note="checkout + webhooks" />
      <StatusRow label="AfroMessage SMS" ok={s.afromessage} note="OTPs" />
      <StatusRow label="Groq LLM"        ok={s.groq} note="AI assistant, proposals, translation" />
      <StatusRow label="Web Push (VAPID)" ok={s.vapidPush} note="browser notifications" />
      <StatusRow label="Resend email"    ok={s.resend} note="saved-search alerts">
        {s.resend && (
          <Button size="sm" variant="brand" onClick={sendTestEmail} disabled={testEmail.isPending}>
            {testEmail.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send test email'}
          </Button>
        )}
      </StatusRow>
      <StatusRow
        label="Metered TURN"
        ok={s.turn.hasKey && s.turn.cachedServerCount > 3}
        note={s.turn.hasKey ? `app: ${s.turn.appName}` : 'no API key'}
      >
        {s.turn.hasKey && (
          <Button size="sm" variant="brand" onClick={() => refreshTurn.mutate()} disabled={refreshTurn.isPending}>
            {refreshTurn.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh TURN'}
          </Button>
        )}
      </StatusRow>

      {s.turn.hasKey && (
        <details className="rounded-2xl border border-border bg-card p-3 text-xs">
          <summary className="cursor-pointer font-semibold">TURN debug details</summary>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
            <div className="text-muted-foreground">app name</div><div>{s.turn.appName}</div>
            <div className="text-muted-foreground">cached at</div><div>{s.turn.cachedAt ?? '—'}</div>
            <div className="text-muted-foreground">servers</div><div>{s.turn.cachedServerCount}</div>
            {s.turn.lastError && (
              <>
                <div className="col-span-2 mt-1 border-t border-border pt-1 text-[10px] text-red-500">Last error</div>
                <div className="text-muted-foreground">at</div><div>{s.turn.lastError.at}</div>
                <div className="text-muted-foreground">url</div><div className="break-all">{s.turn.lastError.url}</div>
                <div className="text-muted-foreground">message</div><div className="break-all">{s.turn.lastError.message}</div>
              </>
            )}
          </div>
        </details>
      )}

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        Auto-refreshes every 5s · last check {new Date(data.ts).toLocaleTimeString()}
      </p>
    </div>
  );
}

function StatusRow({ label, ok, note, children }: { label: string; ok: boolean; note?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className={cn('grid h-8 w-8 place-items-center rounded-full',
        ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500')}>
        {ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{label}</div>
        {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
      </div>
      {children}
    </div>
  );
}
