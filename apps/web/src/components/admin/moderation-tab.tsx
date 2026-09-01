'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { formatEtb, cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';

type Sub = 'gigs' | 'jobs' | 'reviews';

const gigStatusTone: Record<string, 'ok' | 'warn' | 'neutral' | 'bad'> = {
  ACTIVE: 'ok', PAUSED: 'warn', DRAFT: 'neutral', ARCHIVED: 'bad',
};

export function ModerationTab() {
  const [sub, setSub] = useState<Sub>('gigs');
  const token = useToken();
  const qc = useQueryClient();
  const scan = useMutation({
    mutationFn: () => apiFetch<{ scanned: number; flagged: number; items: { id: string; kind: string; title: string; summary: string }[] }>('/admin/ops/moderation/scan', { method: 'POST', token }),
    onSuccess: (r) => {
      toast.success(`Scanned ${r.scanned} items — flagged ${r.flagged}`);
      qc.invalidateQueries({ queryKey: ['admin/gigs'] });
      qc.invalidateQueries({ queryKey: ['admin/reports'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Scan failed'),
  });
  return (
    <div className="space-y-5">
      <SectionHead
        title="Moderation"
        subtitle="Review and act on gigs, jobs and reviews"
        actions={
          <button onClick={() => scan.mutate()} disabled={scan.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
            <ScanSearch className="h-3.5 w-3.5" />
            {scan.isPending ? 'Scanning…' : 'Run auto-flag scan'}
          </button>
        }
      />
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(['gigs', 'jobs', 'reviews'] as Sub[]).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-bold capitalize transition-colors', sub === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            {s}
          </button>
        ))}
      </div>
      {sub === 'gigs' && <GigsModeration />}
      {sub === 'jobs' && <JobsModeration />}
      {sub === 'reviews' && <ReviewsModeration />}
    </div>
  );
}

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

function GigsModeration() {
  const token = useToken();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/gigs', status, flaggedOnly],
    queryFn: () => apiFetch(`/admin/ops/gigs?status=${status}&${flaggedOnly ? 'flagged=1' : ''}&limit=25`, { token }),
  });

  const act = useMutation({
    mutationFn: (vars: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/admin/ops/gigs/${vars.id}/moderate`, { method: 'POST', token, body: vars.body }),
    onSuccess: () => { toast.success('Gig updated'); qc.invalidateQueries({ queryKey: ['admin/gigs'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inputCls, 'w-auto')}>
          <option value="">All statuses</option>
          {['ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only
        </label>
      </div>
      {isLoading ? <Spinner label="Loading gigs…" /> : items.length === 0 ? <Empty message="No gigs found" /> : (
        <TableShell>
          <thead><tr><Th>Gig</Th><Th>Owner</Th><Th>Price</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id} className="border-b border-border/50">
                <Td className="max-w-[240px]"><div className="truncate font-bold">{g.title}</div><div className="text-[11px] text-muted-foreground">@{g.owner?.username}</div></Td>
                <Td className="text-muted-foreground">{formatEtb(g.startingPriceEtb)}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={gigStatusTone[g.status] ?? 'neutral'}>{g.status}</Badge>
                    {g.isFlagged && <Badge tone="bad">flagged</Badge>}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {g.status === 'ACTIVE' && <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: g.id, body: { status: 'PAUSED' } })}>Pause</Button>}
                    {g.status === 'PAUSED' && <Button size="sm" variant="brand" disabled={act.isPending} onClick={() => act.mutate({ id: g.id, body: { status: 'ACTIVE' } })}>Activate</Button>}
                    <Button size="sm" variant={g.isFlagged ? 'outline' : 'destructive'} disabled={act.isPending} onClick={() => act.mutate({ id: g.id, body: { isFlagged: !g.isFlagged, flaggedReason: g.isFlagged ? null : 'Admin flag' } })}>
                      {g.isFlagged ? 'Unflag' : 'Flag'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: g.id, body: { setFeaturedUntil: g.isFeatured ? null : new Date(Date.now() + 7 * 864e5).toISOString() } })}>
                      {g.isFeatured ? 'Unfeature' : 'Feature 7d'}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}

function JobsModeration() {
  const token = useToken();
  const qc = useQueryClient();
  const [open, setOpen] = useState('');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/jobs', open],
    queryFn: () => apiFetch(`/admin/ops/jobs?limit=25${open ? `&open=${open === '1' ? '1' : '0'}` : ''}`, { token }),
  });
  const act = useMutation({
    mutationFn: (vars: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/admin/ops/jobs/${vars.id}/moderate`, { method: 'POST', token, body: vars.body }),
    onSuccess: () => { toast.success('Job updated'); qc.invalidateQueries({ queryKey: ['admin/jobs'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-3">
      <select value={open} onChange={(e) => setOpen(e.target.value)} className={cn(inputCls, 'w-auto')}>
        <option value="">All jobs</option>
        <option value="1">Open</option>
        <option value="0">Closed</option>
      </select>
      {isLoading ? <Spinner label="Loading jobs…" /> : items.length === 0 ? <Empty message="No jobs found" /> : (
        <TableShell>
          <thead><tr><Th>Job</Th><Th>Client</Th><Th>Budget</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {items.map((j) => (
              <tr key={j.id} className="border-b border-border/50">
                <Td className="max-w-[240px]"><div className="truncate font-bold">{j.title}</div></Td>
                <Td className="text-muted-foreground">@{j.client?.username}</Td>
                <Td className="text-muted-foreground">{j.budgetMinEtb != null ? `${formatEtb(j.budgetMinEtb)}–${formatEtb(j.budgetMaxEtb)}` : '—'}</Td>
                <Td><Badge tone={j.isOpen ? 'ok' : 'neutral'}>{j.isOpen ? 'Open' : 'Closed'}</Badge></Td>
                <Td>
                  <div className="flex gap-1.5">
                    {j.isOpen
                      ? <Button size="sm" variant="destructive" disabled={act.isPending} onClick={() => act.mutate({ id: j.id, body: { isOpen: false } })}>Close</Button>
                      : <Button size="sm" variant="brand" disabled={act.isPending} onClick={() => act.mutate({ id: j.id, body: { isOpen: true } })}>Reopen</Button>}
                    <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: j.id, body: { pinned: !j.pinnedAt } })}>{j.pinnedAt ? 'Unpin' : 'Pin'}</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}

function ReviewsModeration() {
  const token = useToken();
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/reviews', hidden],
    queryFn: () => apiFetch(`/admin/ops/reviews?limit=100${hidden ? '&hidden=1' : ''}`, { token }),
  });
  const act = useMutation({
    mutationFn: (vars: { id: string; action: 'HIDE' | 'RESTORE'; reason?: string }) =>
      apiFetch(`/admin/ops/reviews/${vars.id}/moderate`, { method: 'POST', token, body: { action: vars.action, reason: vars.reason } }),
    onSuccess: () => { toast.success('Review updated'); qc.invalidateQueries({ queryKey: ['admin/reviews'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />Show hidden only</label>
      {isLoading ? <Spinner label="Loading reviews…" /> : items.length === 0 ? <Empty message="No reviews found" /> : (
        <TableShell>
          <thead><tr><Th>Subject</Th><Th>Rating</Th><Th>Comment</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <Td className="text-muted-foreground">@{r.subject?.username}</Td>
                <Td>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Td>
                <Td className="max-w-[260px]"><div className="line-clamp-2 text-muted-foreground">{r.comment || '—'}</div></Td>
                <Td><Badge tone={r.hiddenAt ? 'bad' : 'ok'}>{r.hiddenAt ? 'Hidden' : 'Live'}</Badge></Td>
                <Td>
                  {r.hiddenAt
                    ? <Button size="sm" variant="brand" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'RESTORE' })}>Restore</Button>
                    : <Button size="sm" variant="destructive" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'HIDE', reason: 'Admin hide' })}>Hide</Button>}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
