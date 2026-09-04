'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, inputCls, TableShell, Th, Td } from './admin-ui';

type Setting = { key: string; description: string; value: unknown; updatedAt: string | null; updatedByName?: string; exists: boolean };

export function SettingsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [view, setView] = useState<'settings' | 'email' | 'categories' | 'kpi'>('settings');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/settings'],
    queryFn: () => apiFetch('/admin/ops/settings', { token }),
  });
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const save = useMutation({
    mutationFn: (item: Setting) => apiFetch('/admin/ops/settings', { method: 'POST', token, body: { key: item.key, value: draft[item.key] } }),
    onSuccess: () => { toast.success('Setting saved'); qc.invalidateQueries({ queryKey: ['admin/settings'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const items: Setting[] = data?.items ?? [];
  // Seed the draft with current values once loaded.
  if (!Object.keys(draft).length && items.length) {
    for (const it of items) draft[it.key] = it.value;
  }

  return (
    <div className="space-y-4">
      <SectionHead title="Platform settings" subtitle="Fees, limits, feature flags and email delivery" actions={
        <div className="flex gap-1">
          {(['settings', 'categories', 'kpi', 'email'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn('rounded-full px-3 py-1 text-[11px] font-bold capitalize', view === v ? 'bg-primary text-white' : 'border border-border text-muted-foreground')}>{v}</button>
          ))}
        </div>
      } />
      {view === 'email' ? <EmailQueue token={token} />
        : view === 'categories' ? <CategoryFees token={token} />
        : view === 'kpi' ? <KpiWatcher token={token} />
        : isLoading ? <Spinner label="Loading settings…" /> : items.length === 0 ? <Empty message="No settings" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it) => {
            const value = draft[it.key];
            const isBool = typeof it.value === 'boolean';
            const isNum = typeof it.value === 'number' || (value != null && typeof value === 'number');
            const isAnnouncement = it.key === 'content.siteAnnouncement';
            const ann = (value && typeof value === 'object') ? value as Record<string, string> : {};
            return (
              <div key={it.key} className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-sm font-extrabold">{it.key}</div><div className="text-[11px] text-muted-foreground">{it.description}</div></div>
                  {it.updatedByName && <Badge tone="info">{it.updatedByName}</Badge>}
                </div>
                {isAnnouncement ? (
                  <div className="space-y-2">
                    <input type="text" placeholder="Announcement text (empty = off)" value={ann.text ?? ''} className={inputCls}
                      onChange={(e) => setDraft({ ...draft, [it.key]: { ...ann, text: e.target.value } })} />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={ann.tone ?? 'info'} className={inputCls}
                        onChange={(e) => setDraft({ ...draft, [it.key]: { ...ann, tone: e.target.value } })}>
                        <option value="info">Info</option>
                        <option value="promo">Promo</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <input type="text" placeholder="CTA (optional)" value={ann.cta ?? ''} className={inputCls}
                        onChange={(e) => setDraft({ ...draft, [it.key]: { ...ann, cta: e.target.value } })} />
                    </div>
                    <input type="text" placeholder="Link (e.g. /browse or https://…)" value={ann.href ?? ''} className={inputCls}
                      onChange={(e) => setDraft({ ...draft, [it.key]: { ...ann, href: e.target.value } })} />
                  </div>
                ) : isBool ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!value} disabled={save.isPending}
                      onChange={(e) => setDraft({ ...draft, [it.key]: e.target.checked })} />
                    {value ? 'Enabled' : 'Disabled'}
                  </label>
                ) : isNum ? (
                  <input type="number" value={value as number ?? ''} className={inputCls}
                    onChange={(e) => setDraft({ ...draft, [it.key]: Number(e.target.value) })} />
                ) : (
                  <input type="text" value={String(value ?? '')} className={inputCls}
                    onChange={(e) => setDraft({ ...draft, [it.key]: e.target.value })} />
                )}
                <Button size="sm" variant="brand" disabled={save.isPending} onClick={() => save.mutate(it)}>Save</Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- EMAIL QUEUE ----------
const eqTone: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = { SENT: 'ok', QUEUED: 'warn', FAILED: 'bad' };
interface EqRow { id: string; to: string; subject: string; status: string; attempts: number; lastError: string | null; createdAt: string }
interface EqData {
  counts: { queued: number; sent: number; failed: number; total: number };
  deliveryRate: number;
  recent: EqRow[];
  topFailures: { error: string; count: number }[];
}
function EmailQueue({ token }: { token: string | null }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<EqData>({
    queryKey: ['admin/email-queue'],
    queryFn: () => apiFetch('/admin/ops/email-queue?limit=30', { token }),
    enabled: !!token,
  });
  const flush = useMutation({
    mutationFn: () => apiFetch('/admin/ops/email-queue/flush', { method: 'POST', token }),
    onSuccess: (r: any) => { toast.success(`Flushed ${r.scanned} queued email(s)`); qc.invalidateQueries({ queryKey: ['admin/email-queue'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Durable outbound email queue. Retry queued rows without waiting for the cron tick.</p>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => refetch()} disabled={isLoading} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-50">Refresh</button>
          <button onClick={() => flush.mutate()} disabled={flush.isPending} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
            {flush.isPending ? <Spinner label="" /> : 'Flush queue'}
          </button>
        </div>
      </div>
      {isLoading || !data ? <Spinner label="Loading queue…" /> : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <EqStat label="Queued" value={data.counts.queued} warn={data.counts.queued > 0} />
            <EqStat label="Sent" value={data.counts.sent} />
            <EqStat label="Failed" value={data.counts.failed} warn={data.counts.failed > 0} />
            <EqStat label="Success" value={`${(data.deliveryRate * 100).toFixed(0)}%`} />
          </div>
          {data.topFailures.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Top delivery errors</div>
              <div className="mt-1.5 space-y-1 text-xs">
                {data.topFailures.map((f) => (
                  <div key={f.error} className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-[11px] text-muted-foreground">{f.error}</span>
                    <span className="shrink-0 font-bold">{f.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(data.recent ?? []).length === 0 ? <Empty message="No emails yet" /> : (
            <TableShell>
              <thead><tr><Th>To</Th><Th>Subject</Th><Th>Status</Th><Th>When</Th></tr></thead>
              <tbody>
                {data.recent.map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <Td className="text-muted-foreground">{e.to}</Td>
                    <Td><div className="truncate max-w-[220px]">{e.subject}</div>{e.lastError && <div className="truncate max-w-[220px] text-[10px] text-red-500">{e.lastError}</div>}</Td>
                    <Td><Badge tone={eqTone[e.status] ?? 'neutral'}>{e.status}</Badge>{e.attempts > 1 && <span className="ml-1 text-[10px] text-muted-foreground">×{e.attempts}</span>}</Td>
                    <Td className="text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</Td>
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
function EqStat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-3 ${warn ? 'border-amber-500/40' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

// ---------- CATEGORY FEES ----------
interface CategoryRow {
  id: string; label: string; icon: string; feePercent: number | null;
  effectiveFeePercent: number; isActive: boolean; sortOrder: number;
  updatedAt: string | null; updatedByName: string | null;
}
function CategoryFees({ token }: { token: string | null }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({ queryKey: ['admin/categories'], queryFn: () => apiFetch('/admin/ops/categories', { token }) });
  const [fee, setFee] = useState<Record<string, string>>({});
  const [active, setActive] = useState<Record<string, boolean>>({});
  const save = useMutation({
    mutationFn: (c: CategoryRow) => apiFetch(`/admin/ops/categories/${c.id}`, {
      method: 'PATCH', token, body: {
        feePercent: fee[c.id] === '' ? null : Number(fee[c.id]),
        isActive: active[c.id] ?? c.isActive,
      },
    }),
    onSuccess: () => { toast.success('Category saved'); qc.invalidateQueries({ queryKey: ['admin/categories'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const reset = useMutation({
    mutationFn: (c: CategoryRow) => apiFetch(`/admin/ops/categories/${c.id}/reset-fee`, { method: 'POST', token }),
    onSuccess: () => { toast.success('Fee reset to global'); qc.invalidateQueries({ queryKey: ['admin/categories'] }); },
  });
  const items: CategoryRow[] = data?.items ?? [];
  if (!Object.keys(fee).length && items.length) {
    for (const c of items) fee[c.id] = c.feePercent === null ? '' : String(c.feePercent);
    for (const c of items) active[c.id] = c.isActive;
  }
  return (
    <div className="space-y-3">
      <SectionHead title="Per-category fees" subtitle="Override the global platform fee per category. Blank = inherit global fee." />
      {isLoading ? <Spinner label="Loading categories…" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => (
            <div key={c.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{c.icon}</span>
                  <div>
                    <div className="text-sm font-extrabold">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">@{c.id}</div>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={active[c.id] ?? c.isActive} onChange={(e) => setActive({ ...active, [c.id]: e.target.checked })} /> Active
                </label>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input type="number" min={0} max={50} value={fee[c.id] ?? ''} placeholder="inherit global" className={inputCls} onChange={(e) => setFee({ ...fee, [c.id]: e.target.value })} />
                </div>
                <span className="text-sm text-muted-foreground">%</span>
                <Badge tone={c.feePercent === null ? 'neutral' : 'info'}>eff {c.effectiveFeePercent}%</Badge>
              </div>
              {c.updatedByName && <div className="text-[10px] text-muted-foreground">By {c.updatedByName}</div>}
              <div className="flex gap-2">
                <Button size="sm" variant="brand" disabled={save.isPending} onClick={() => save.mutate(c)}>Save</Button>
                {c.feePercent !== null && <Button size="sm" variant="ghost" disabled={reset.isPending} onClick={() => reset.mutate(c)}>Reset</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- KPI WATCHER ----------
interface ThrRow {
  id: string; key: string; label: string; operator: 'lt' | 'gt'; value: number;
  windowDays: number; enabled: boolean; severity: string; currentValue: number | null;
  unit: string; hasOpenAlert: boolean; openAlertStatus: string | null;
}
interface AlertRow {
  id: string; key: string; label: string; operator: string; metricValue: number;
  thresholdValue: number; severity: string; status: string; message: string | null;
  firedAt: string; acknowledgedAt: string | null; acknowledgedBy?: { fullName: string; username: string } | null;
}
function KpiWatcher({ token }: { token: string | null }) {
  const qc = useQueryClient();
  const { data: thrData, isLoading: thrLoading } = useQuery<any>({ queryKey: ['admin/kpi/thresholds'], queryFn: () => apiFetch('/admin/ops/kpi/thresholds', { token }) });
  const { data: alertData } = useQuery<any>({ queryKey: ['admin/kpi/alerts'], queryFn: () => apiFetch('/admin/ops/kpi/alerts?status=ALL&limit=50', { token }) });
  const [draft, setDraft] = useState<Record<string, number>>({});
  const save = useMutation({
    mutationFn: (t: ThrRow) => apiFetch(`/admin/ops/kpi/thresholds/${t.id}`, { method: 'PUT', token, body: { value: draft[t.id] ?? t.value, operator: t.operator, enabled: t.enabled, severity: t.severity } }),
    onSuccess: () => { toast.success('Threshold saved'); qc.invalidateQueries({ queryKey: ['admin/kpi'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const toggle = useMutation({
    mutationFn: (t: ThrRow) => apiFetch(`/admin/ops/kpi/thresholds/${t.id}`, { method: 'PUT', token, body: { enabled: !t.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin/kpi'] }),
  });
  const ack = useMutation({
    mutationFn: (a: AlertRow) => apiFetch(`/admin/ops/kpi/alerts/${a.id}/acknowledge`, { method: 'POST', token }),
    onSuccess: () => { toast.success('Alert acknowledged'); qc.invalidateQueries({ queryKey: ['admin/kpi'] }); },
  });
  const recheck = useMutation({
    mutationFn: () => apiFetch('/admin/ops/kpi/thresholds', { method: 'GET', token }),
    onSuccess: () => { toast.success('Refreshed'); qc.invalidateQueries({ queryKey: ['admin/kpi'] }); },
  });
  const thresholds: ThrRow[] = thrData?.items ?? [];
  const alerts: AlertRow[] = alertData?.items ?? [];
  if (!Object.keys(draft).length && thresholds.length) {
    for (const t of thresholds) draft[t.id] = t.value;
  }
  const openCount = alerts.filter((a) => a.status === 'OPEN').length;
  const sevTone: Record<string, 'bad' | 'warn' | 'info'> = { critical: 'bad', warn: 'warn', info: 'info' };
  return (
    <div className="space-y-4">
      <SectionHead title="KPI threshold watcher" subtitle="Alert when a business metric crosses a configured threshold. Run every 15 min by the cron tick." actions={
        <Button size="sm" variant="outline" onClick={() => recheck.mutate()}><span className="mr-1">↻</span> Refresh</Button>
      } />
      <div className={`flex items-center gap-2 rounded-2xl border p-3 ${openCount ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-card'}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${openCount ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <span className="text-sm font-bold">{openCount} open alert{openCount === 1 ? '' : 's'}</span>
        <span className="text-xs text-muted-foreground">Acknowledge to track your response.</span>
      </div>

      {thrLoading ? <Spinner label="Loading thresholds…" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {thresholds.map((t) => (
            <div key={t.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground">{t.key} · {t.windowDays ? `${t.windowDays}d window` : 'live'}</div>
                </div>
                <Badge tone={sevTone[t.severity] ?? 'neutral'}>{t.severity}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-muted-foreground">Current</div>
                  <div className="text-lg font-extrabold">{t.currentValue == null ? '—' : t.currentValue}{t.unit ? ` ${t.unit}` : ''}</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-muted-foreground">Threshold</div>
                  <input type="number" value={draft[t.id] ?? t.value} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-center text-sm outline-none" onChange={(e) => setDraft({ ...draft, [t.id]: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Operator: <b>{t.operator === 'lt' ? 'below' : 'above'}</b></span>
                {t.hasOpenAlert ? <Badge tone="warn">{t.openAlertStatus === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Alert open'}</Badge> : <Badge tone="ok">OK</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="brand" disabled={save.isPending} onClick={() => save.mutate(t)}>Save</Button>
                <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(t)}>{t.enabled ? 'Disable' : 'Enable'}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-sm font-extrabold">Recent alerts</div>
        {alerts.length === 0 ? <Empty message="No alerts yet" /> : alerts.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold">{a.label}
                <Badge tone={sevTone[a.severity] ?? 'neutral'}>{a.severity}</Badge>
                <Badge tone={a.status === 'OPEN' ? 'warn' : a.status === 'ACKNOWLEDGED' ? 'info' : 'ok'}>{a.status}</Badge>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.message}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(a.firedAt).toLocaleString()}{a.acknowledgedBy ? ` · acked by ${a.acknowledgedBy.fullName}` : ''}</div>
            </div>
            {(a.status === 'OPEN' || a.status === 'ACKNOWLEDGED') && <Button size="sm" variant="outline" onClick={() => ack.mutate(a)}>Acknowledge</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
