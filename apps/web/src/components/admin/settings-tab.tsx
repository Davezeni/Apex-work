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
  const [view, setView] = useState<'settings' | 'email'>('settings');
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
          {(['settings', 'email'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn('rounded-full px-3 py-1 text-[11px] font-bold capitalize', view === v ? 'bg-primary text-white' : 'border border-border text-muted-foreground')}>{v}</button>
          ))}
        </div>
      } />
      {view === 'email' ? <EmailQueue token={token} /> : isLoading ? <Spinner label="Loading settings…" /> : items.length === 0 ? <Empty message="No settings" /> : (
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
