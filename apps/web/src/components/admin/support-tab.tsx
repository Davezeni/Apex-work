'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';
const tone: Record<string, 'ok' | 'warn' | 'neutral' | 'info' | 'bad'> = {
  OPEN: 'warn',
  WAITING_USER: 'info',
  WAITING_STAFF: 'warn',
  RESOLVED: 'ok',
  CLOSED: 'neutral',
};

export function SupportTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [view, setView] = useState<'queue' | 'sla'>('queue');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/tickets', status],
    queryFn: () =>
      apiFetch(`/admin/ops/tickets?limit=30${status ? `&status=${status}` : ''}`, { token }),
  });
  const replyMut = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/ops/tickets/${open!.id}/reply`, {
        method: 'POST',
        token,
        body: { body: reply },
      }),
    onSuccess: () => {
      toast.success(dt('Reply sent'));
      setReply('');
      qc.invalidateQueries({ queryKey: ['admin/tickets'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const statusMut = useMutation({
    mutationFn: (s: string) =>
      apiFetch(`/admin/ops/tickets/${open!.id}/status`, {
        method: 'POST',
        token,
        body: { status: s },
      }),
    onSuccess: (d: any) => {
      toast.success(dt('Ticket updated'));
      setOpen({ ...open, status: d.status });
      qc.invalidateQueries({ queryKey: ['admin/tickets'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-5">
      <SectionHead
        title={dt('Support')}
        subtitle={dt('Customer support ticket queue')}
        actions={
          <div className="flex gap-1">
            {(['queue', 'sla'] as const).map((v) => (
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
      {view === 'sla' ? (
        <SupportAnalytics token={token} />
      ) : (
        <>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(inputCls, 'w-auto')}
          >
            <option value="">{dt('All statuses')}</option>
            {Object.keys(tone).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {isLoading ? (
            <Spinner label={dt('Loading tickets…')} />
          ) : items.length === 0 ? (
            <Empty message="No tickets" />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>{dt('Subject')}</Th>
                  <Th>{dt('User')}</Th>
                  <Th>{dt('Status')}</Th>
                  <Th>{dt('CSAT')}</Th>
                  <Th>{dt('Messages')}</Th>
                  <Th>{dt('Open')}</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <Td className="max-w-[240px]">
                      <div className="truncate font-bold">{t.subject}</div>
                      <div className="text-[11px] text-muted-foreground">{t.category}</div>
                    </Td>
                    <Td className="text-muted-foreground">@{t.user?.username}</Td>
                    <Td>
                      <Badge tone={tone[t.status] ?? 'neutral'}>{t.status}</Badge>
                    </Td>
                    <Td>
                      {t.csatRating ? (
                        <span className="font-semibold text-amber-500">
                          {'★'.repeat(t.csatRating)}
                          <span className="text-muted-foreground/60">
                            {'☆'.repeat(5 - t.csatRating)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{t._count?.messages ?? 0}</Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpen(t);
                          setReply('');
                        }}
                      >
                        {dt('Open')}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-extrabold">{open.subject}</h3>
                <p className="text-[11px] text-muted-foreground">
                  @{open.user?.username} · {open.category}
                </p>
              </div>
              <Badge tone={tone[open.status] ?? 'neutral'}>{open.status}</Badge>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-sm">
              {open.messages?.length ? (
                open.messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={cn(
                      'rounded-lg px-3 py-2',
                      m.isStaff ? 'bg-primary/10 text-right' : 'bg-background',
                    )}
                  >
                    {m.isStaff && (
                      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {dt('Staff')}
                      </div>
                    )}
                    {m.body}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground">{dt('No messages yet')}</p>
              )}
            </div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder={dt('Type a reply…')}
              className={inputCls}
            />
            <div className="flex justify-between gap-2">
              <div className="flex gap-2">
                {open.status !== 'RESOLVED' && open.status !== 'CLOSED' && (
                  <Button
                    size="sm"
                    variant="brand"
                    disabled={statusMut.isPending}
                    onClick={() => statusMut.mutate('RESOLVED')}
                  >
                    {dt('Resolve')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={statusMut.isPending}
                  onClick={() => statusMut.mutate('CLOSED')}
                >
                  {dt('Close')}
                </Button>
              </div>
              <Button
                size="sm"
                variant="default"
                disabled={!reply.trim() || replyMut.isPending}
                onClick={() => replyMut.mutate()}
              >
                {replyMut.isPending ? 'Sending…' : 'Send reply'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SLA {
  openTickets: number;
  breachedOpen: number;
  unattendedOpen: number;
  oldestOpenMin: number;
  resolvedWindow: number;
  avgTimeToFirstResponseMin: number;
  byAdmin: { adminId: string; handled: number; avgFirstResponseMin: number }[];
  asOf: string;
}
function SupportAnalytics({ token }: { token: string | null }) {
  const { data, isLoading, refetch } = useQuery<SLA>({
    queryKey: ['admin/support/analytics'],
    queryFn: () => apiFetch('/admin/ops/support/analytics', { token }),
    enabled: !!token,
  });
  if (isLoading || !data) return <Spinner label={dt('Building SLA…')} />;
  const fmtMin = (m: number) => (m >= 120 ? `${Math.round(m / 60)}h ${m % 60}m` : `${m}m`);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label={dt('Open tickets')} value={String(data.openTickets)} />
        <Stat
          label={dt('Unattended')}
          value={String(data.unattendedOpen)}
          warn={data.unattendedOpen > 0}
        />
        <Stat
          label={dt('SLA breached')}
          value={String(data.breachedOpen)}
          warn={data.breachedOpen > 0}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={dt('Resolved (7d)')} value={String(data.resolvedWindow)} />
        <Stat
          label={dt('Avg first reply')}
          value={data.avgTimeToFirstResponseMin ? fmtMin(data.avgTimeToFirstResponseMin) : '—'}
        />
      </div>
      {data.oldestOpenMin > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600">
          Oldest open ticket: {fmtMin(data.oldestOpenMin)}
        </div>
      )}
      {data.byAdmin.length > 0 && (
        <TableShell>
          <thead>
            <tr>
              <Th>{dt('Admin')}</Th>
              <Th>{dt('Handled')}</Th>
              <Th>{dt('Avg first reply')}</Th>
            </tr>
          </thead>
          <tbody>
            {data.byAdmin.map((a) => (
              <tr key={a.adminId} className="border-b border-border/50">
                <Td className="text-muted-foreground">@{a.adminId.slice(0, 8)}…</Td>
                <Td className="font-semibold">{a.handled}</Td>
                <Td className="text-muted-foreground">
                  {a.avgFirstResponseMin ? fmtMin(a.avgFirstResponseMin) : '—'}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>SLA window: 24h to first response</span>
        <button onClick={() => refetch()} className="font-bold underline decoration-dotted">
          {dt('Refresh')}
        </button>
      </div>
    </div>
  );
}
function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-3 ${warn ? 'border-red-500/40' : ''}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
