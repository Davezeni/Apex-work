'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  ArrowLeft, Users, ShoppingBag, Briefcase, Package, Wallet as WalletIcon, Flag,
  ShieldOff, ShieldCheck, Loader2, CheckCircle, XCircle, TrendingUp,
  BarChart3, AlertTriangle as AlertTri, Award as AwardIcon, Cpu, Menu, X as CloseIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatEtb, formatCompact, timeAgo, cn } from '@/lib/utils';
import { ModerationTab } from '@/components/admin/moderation-tab';
import { MoneyTab } from '@/components/admin/money-tab';
import { SupportTab } from '@/components/admin/support-tab';
import { PromotionsTab } from '@/components/admin/promotions-tab';
import { SubscriptionsTab } from '@/components/admin/subscriptions-tab';
import { SettingsTab } from '@/components/admin/settings-tab';
import { AuditTab } from '@/components/admin/audit-tab';
import { AdminsTab } from '@/components/admin/admins-tab';
import { canRole } from '@/components/admin/rbac';
import { TrendChart, type SeriesPoint } from '@/components/admin/trend-chart';
import { ExportButton } from '@/components/admin/export-button';

/** Staff roles that may access the admin panel (mirrors @apex-work/shared). */
const STAFF_ROLES = ['ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE'];
const isStaffRole = (role: string) => STAFF_ROLES.includes(role);

/**
 * Build marker for the admin panel surface. Bump this on material admin UI
 * changes so you can confirm the deployed build matches what you expect —
 * handy when debugging a stale Vercel deployment.
 */
export const ADMIN_UI_BUILD = '2026-09-01.2';

type Tab =
  | 'summary' | 'reports' | 'disputes' | 'withdrawals' | 'users' | 'certs' | 'diagnostics'
  | 'moderation' | 'money' | 'support' | 'promotions' | 'subscriptions' | 'settings' | 'audit' | 'admins';

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
    if (me && !isStaffRole(me.role)) {
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
  if (!isStaffRole(me.role)) {
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
    <AdminShell role={me.role} tab={tab} onChange={setTab} onBack={() => router.back()}>
      {tab === 'summary' && <SummaryTab />}
      {tab === 'moderation' && <ModerationTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'money' && <MoneyTab />}
      {tab === 'disputes' && <DisputesTab />}
      {tab === 'withdrawals' && <WithdrawalsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'support' && <SupportTab />}
      {tab === 'promotions' && <PromotionsTab />}
      {tab === 'subscriptions' && <SubscriptionsTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'admins' && <AdminsTab />}
      {tab === 'certs' && <CertsTab />}
      {tab === 'diagnostics' && <DiagnosticsTab />}
    </AdminShell>
  );
}

// -----------------------------------------------------------------------------
// ADMIN SHELL — collapsible sidebar on desktop, drawer on mobile
// -----------------------------------------------------------------------------
const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode; cap: string }[] = [
  { id: 'summary',       label: 'Summary',        icon: <BarChart3 className="h-4 w-4" />, cap: 'dashboard:view' },
  { id: 'moderation',    label: 'Moderation',     icon: <ShieldOff className="h-4 w-4" />, cap: 'moderation:content' },
  { id: 'reports',       label: 'Reports',        icon: <Flag className="h-4 w-4" />, cap: 'moderation:reports' },
  { id: 'money',         label: 'Orders & Money', icon: <WalletIcon className="h-4 w-4" />, cap: 'money:orders' },
  { id: 'disputes',      label: 'Disputes',       icon: <AlertTri className="h-4 w-4" />, cap: 'moderation:reports' },
  { id: 'withdrawals',   label: 'Withdrawals',    icon: <WalletIcon className="h-4 w-4" />, cap: 'money:withdrawals' },
  { id: 'users',         label: 'Users',          icon: <Users className="h-4 w-4" />, cap: 'dashboard:view' },
  { id: 'support',       label: 'Support',        icon: <Briefcase className="h-4 w-4" />, cap: 'support:tickets' },
  { id: 'promotions',    label: 'Promotions',     icon: <TrendingUp className="h-4 w-4" />, cap: 'promotions:manage' },
  { id: 'subscriptions', label: 'Subscriptions',  icon: <Package className="h-4 w-4" />, cap: 'subscriptions:manage' },
  { id: 'settings',      label: 'Settings',       icon: <ShieldCheck className="h-4 w-4" />, cap: 'settings:manage' },
  { id: 'audit',         label: 'Audit log',      icon: <BarChart3 className="h-4 w-4" />, cap: 'audit:view' },
  { id: 'admins',        label: 'Admin team',     icon: <Users className="h-4 w-4" />, cap: 'audit:view' },
  { id: 'certs',         label: 'Certifications', icon: <AwardIcon className="h-4 w-4" />, cap: 'moderation:certs' },
  { id: 'diagnostics',   label: 'Diagnostics',    icon: <Cpu className="h-4 w-4" />, cap: 'artifacts:view' },
];

const SIDEBAR_KEY = 'apex-admin-sidebar-collapsed';

function AdminShell({
  role, tab, onChange, onBack, children,
}: { role: string; tab: Tab; onChange: (t: Tab) => void; onBack: () => void; children: React.ReactNode }) {
  // Show only the nav items the caller's role is permitted to use.
  const visibleItems = NAV_ITEMS.filter((n) => canRole(role, n.cap));
  // Persisted collapsed state so pros keep their layout across sessions.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = visibleItems.find((n) => n.id === tab) ?? visibleItems[0]!;

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-card md:flex',
          collapsed ? 'w-16' : 'w-60',
          'transition-[width] duration-200 ease-out',
        )}
        aria-label="Admin navigation"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-4">
          <div className="grad-hero grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-white">A</div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold">Admin</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Staff · {ADMIN_UI_BUILD}</div>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {visibleItems.map((n) => (
            <button
              key={n.id}
              onClick={() => onChange(n.id)}
              title={collapsed ? n.label : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                tab === n.id
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-0',
              )}
            >
              {n.icon}
              {!collapsed && <span className="truncate">{n.label}</span>}
            </button>
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <button
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <><ArrowLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="safe-top relative flex h-full w-64 flex-col border-r border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-4">
              <div className="grad-hero grid h-8 w-8 place-items-center rounded-lg text-sm font-extrabold text-white">A</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold">Admin</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Staff</div>
              </div>
              <button onClick={() => setMobileOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {visibleItems.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { onChange(n.id); setMobileOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    tab === n.id
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {n.icon}<span>{n.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main pane */}
      <main className="min-w-0 flex-1">
        <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
          <button
            onClick={onBack}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full active:scale-90 md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-full active:scale-90 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin</div>
            <h1 className="truncate text-lg font-extrabold tracking-tight">{active.label}</h1>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">STAFF</span>
        </header>
        <div className="pb-24">{children}</div>
      </main>
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
interface AnalyticsSeriesResp {
  days: number;
  start: string;
  end: string;
  metrics: {
    signups: SeriesPoint[];
    ordersCreated: SeriesPoint[];
    ordersCompleted: SeriesPoint[];
    gmvEtb: SeriesPoint[];
    revenueEtb: SeriesPoint[];
  };
}
function SummaryTab() {
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ['admin', 'summary'],
    queryFn: () => apiFetch('/admin/summary', { token }),
    enabled: !!token,
  });
  const [seriesDays, setSeriesDays] = useState(30);
  const { data: series } = useQuery<AnalyticsSeriesResp>({
    queryKey: ['admin', 'analytics-series', seriesDays],
    queryFn: () => apiFetch<AnalyticsSeriesResp>(`/admin/ops/analytics/series?days=${seriesDays}`, { token }),
    enabled: !!token,
  });
  if (isLoading || !data) return <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const m = series?.metrics;
  const gmvTotal = m?.gmvEtb.reduce((s, p) => s + (p.value ?? 0), 0) ?? 0;
  const revTotal = m?.revenueEtb.reduce((s, p) => s + (p.value ?? 0), 0) ?? 0;
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

      {series && (
        <div className="space-y-3">
          <SectionHead2>Activity · last {seriesDays}d</SectionHead2>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label={`GMV (${seriesDays}d)`} value={formatEtb(gmvTotal)} tone="ok" />
            <MiniStat label={`Revenue (${seriesDays}d)`} value={formatEtb(revTotal)} tone="info" />
          </div>
          <TrendChart
            metric={{ key: 'gmv', label: 'GMV (ETB)', color: '#6366f1', format: (v) => formatCompact(Math.round(v)), series: m!.gmvEtb, useValue: true }}
            days={seriesDays}
            onDaysChange={setSeriesDays}
          />
          <TrendChart
            metric={{ key: 'signups', label: 'Signups', color: '#10b981', format: (v) => String(Math.round(v)), series: m!.signups, useValue: false }}
            days={seriesDays}
            onDaysChange={setSeriesDays}
          />
          <TrendChart
            metric={{ key: 'orders', label: 'Orders created', color: '#0ea5e9', format: (v) => String(Math.round(v)), series: m!.ordersCreated, useValue: false }}
            days={seriesDays}
            onDaysChange={setSeriesDays}
          />
          <TrendChart
            metric={{ key: 'completed', label: 'Orders completed', color: '#f59e0b', format: (v) => String(Math.round(v)), series: m!.ordersCompleted, useValue: false }}
            days={seriesDays}
            onDaysChange={setSeriesDays}
          />
        </div>
      )}
    </div>
  );
}
function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'info' }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
function SectionHead2({ children }: { children: React.ReactNode }) {
  return <div className="pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;
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
      <div className="mb-2 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
        <ExportButton kind="users" params={q ? { q } : {}} />
      </div>
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
    email: {
      configured: boolean;
      from: string;
      lastError: { at: string; to: string; message: string } | null;
      lastSuccess: { at: string; to: string; providerId?: string } | null;
    };
    vapidPush: boolean;
    turn: {
      hasKey: boolean;
      keyPreview: string | null;
      appName: string;
      cachedAt: string | null;
      cachedServerCount: number;
      fallbackActive?: boolean;
      lastError: { at: string; message: string; url: string } | null;
      lastSuccessUrl: string | null;
      lastAttempts: { url: string; ok: boolean; message: string }[];
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
    mutationFn: (to?: string) => apiFetch<{ id: string; to: string; delivered: boolean; error: string | null }>('/admin/email/test', {
      method: 'POST', token, body: to ? { to } : {},
    }),
    onSuccess: (r) => {
      if (r.delivered) {
        toast.success(`Test email sent to ${r.to} — check your inbox`);
      } else {
        toast.error(`Delivery failed: ${r.error ?? 'unknown'}`);
      }
      qc.invalidateQueries({ queryKey: ['admin', 'diagnostics'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Failed'),
  });

  const [emailTo, setEmailTo] = useState('');

  if (isLoading || !data) return <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />;
  const s = data.services;

  return (
    <div className="mx-3 mt-4 space-y-2">
      <StatusRow label="Supabase Storage" ok={s.supabase} note="uploads, avatars, chat attachments" />
      <StatusRow label="Chapa payments"  ok={s.chapa} note="checkout + webhooks" />
      <StatusRow label="AfroMessage SMS" ok={s.afromessage} note="OTPs" />
      <StatusRow label="Groq LLM"        ok={s.groq} note="AI assistant, proposals, translation" />
      <StatusRow label="Web Push (VAPID)" ok={s.vapidPush} note="browser notifications" />
      <StatusRow label="Resend email"    ok={s.resend} note={`from: ${s.email.from}`} />
      {s.resend && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <label className="text-xs font-semibold text-muted-foreground">Send test email to</label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="email"
              inputMode="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="you@example.com (blank = your admin email)"
              className="min-w-0 flex-1 rounded-full border border-input bg-background px-3 py-1.5 text-xs"
            />
            <Button
              size="sm"
              variant="brand"
              onClick={() => testEmail.mutate(emailTo.trim() || undefined)}
              disabled={testEmail.isPending}
            >
              {testEmail.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send test'}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Uses Resend sandbox <code>onboarding@resend.dev</code> (unverified domains only send to the account owner&rsquo;s email).
          </p>
        </div>
      )}

      {s.resend && (s.email.lastError || s.email.lastSuccess) && (
        <details className="rounded-2xl border border-border bg-card p-3 text-xs" open={!!s.email.lastError}>
          <summary className="cursor-pointer font-semibold">Email debug details</summary>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <div className="text-muted-foreground">from</div><div>{s.email.from}</div>
            {s.email.lastSuccess && (
              <>
                <div className="col-span-2 mt-1 border-t border-border pt-1 text-[10px] text-emerald-500">Last success</div>
                <div className="text-muted-foreground">at</div><div>{s.email.lastSuccess.at}</div>
                <div className="text-muted-foreground">to</div><div className="break-all">{s.email.lastSuccess.to}</div>
                <div className="text-muted-foreground">provider id</div><div className="break-all">{s.email.lastSuccess.providerId ?? '—'}</div>
              </>
            )}
            {s.email.lastError && (
              <>
                <div className="col-span-2 mt-1 border-t border-border pt-1 text-[10px] text-red-500">Last error</div>
                <div className="text-muted-foreground">at</div><div>{s.email.lastError.at}</div>
                <div className="text-muted-foreground">to</div><div className="break-all">{s.email.lastError.to}</div>
                <div className="text-muted-foreground">message</div><div className="break-all">{s.email.lastError.message}</div>
              </>
            )}
          </div>
        </details>
      )}
      <StatusRow
        label="Metered TURN"
        ok={s.turn.cachedServerCount > 3}
        note={
          s.turn.fallbackActive
            ? 'OpenRelay fallback active (managed key not connected)'
            : s.turn.hasKey
              ? `Managed TURN · app: ${s.turn.appName}`
              : 'OpenRelay fallback'
        }
      >
        {s.turn.hasKey && (
          <Button size="sm" variant="brand" onClick={() => refreshTurn.mutate()} disabled={refreshTurn.isPending}>
            {refreshTurn.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh TURN'}
          </Button>
        )}
      </StatusRow>

      {s.turn.hasKey && (
        <details className="rounded-2xl border border-border bg-card p-3 text-xs" open={!!s.turn.lastError}>
          <summary className="cursor-pointer font-semibold">TURN debug details</summary>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <div className="text-muted-foreground">app name</div><div>{s.turn.appName}</div>
            <div className="text-muted-foreground">api key</div><div className="break-all">{s.turn.keyPreview ?? '—'}</div>
            <div className="text-muted-foreground">cached at</div><div>{s.turn.cachedAt ?? '—'}</div>
            <div className="text-muted-foreground">servers</div><div>{s.turn.cachedServerCount}</div>
            <div className="text-muted-foreground">last ok url</div><div className="break-all">{s.turn.lastSuccessUrl ?? '—'}</div>
            {s.turn.lastAttempts?.length > 0 && (
              <>
                <div className="col-span-2 mt-1 border-t border-border pt-1 text-[10px] text-muted-foreground">Attempts (most recent probe)</div>
                {s.turn.lastAttempts.map((a, i) => (
                  <div key={i} className="col-span-2 rounded bg-muted/50 p-1.5">
                    <div className={a.ok ? 'text-emerald-500' : 'text-red-500'}>{a.ok ? '✓' : '✗'} {a.message}</div>
                    <div className="break-all text-muted-foreground">{a.url}</div>
                  </div>
                ))}
              </>
            )}
            {s.turn.lastError && (
              <>
                <div className="col-span-2 mt-1 border-t border-border pt-1 text-[10px] text-red-500">Last error</div>
                <div className="text-muted-foreground">at</div><div>{s.turn.lastError.at}</div>
                <div className="text-muted-foreground">url</div><div className="break-all">{s.turn.lastError.url}</div>
                <div className="text-muted-foreground">message</div><div className="break-all">{s.turn.lastError.message}</div>
              </>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Managed TURN not active? Open <a className="underline" href="https://dashboard.metered.ca/" target="_blank" rel="noopener noreferrer">dashboard.metered.ca</a> → sidebar → TURN Server → Manage Credentials → open the credential row → <b>Show API Key</b>. Copy that credential-specific API key into <code>METERED_API_KEY</code> on Render. The Developers → Secret Key is a management key and returns 401 here; calls remain available through the OpenRelay fallback.
          </p>
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
