'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { formatEtb, cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls, Field } from './admin-ui';

export function PromotionsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<'all' | 'freelancers' | 'clients'>('all');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/gigs-featured'],
    queryFn: () => apiFetch('/admin/ops/gigs?limit=50&featured=1', { token }),
  });

  const feature = useMutation({
    mutationFn: (vars: { id: string; days: number }) => apiFetch(`/admin/ops/gigs/${vars.id}/feature`, { method: 'POST', token, body: { days: vars.days } }),
    onSuccess: () => { toast.success('Featured'); qc.invalidateQueries({ queryKey: ['admin/gigs-featured'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const unfeature = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/ops/gigs/${id}/unfeature`, { method: 'POST', token }),
    onSuccess: () => { toast.success('Removed from featured'); qc.invalidateQueries({ queryKey: ['admin/gigs-featured'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const broadcast = useMutation({
    mutationFn: () => apiFetch('/admin/ops/broadcast', { method: 'POST', token, body: { title, body, scope } }),
    onSuccess: () => { toast.success('Broadcast sent'); setTitle(''); setBody(''); },
    onError: (e) => toast.error((e as Error).message),
  });

  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-6">
      <SectionHead title="Promotions" subtitle="Feature gigs and send announcements" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-extrabold">Broadcast announcement</h3>
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></Field>
          <Field label="Body"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputCls} /></Field>
          <Field label="Audience">
            <select value={scope} onChange={(e) => setScope(e.target.value as never)} className={inputCls}>
              <option value="all">Everyone</option><option value="freelancers">Freelancers</option><option value="clients">Clients</option>
            </select>
          </Field>
          <Button variant="brand" disabled={!title.trim() || !body.trim() || broadcast.isPending} onClick={() => broadcast.mutate()}>{broadcast.isPending ? 'Sending…' : 'Send broadcast'}</Button>
        </div>

        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-extrabold">Featured gigs</h3>
          {isLoading ? <Spinner label="Loading…" /> : items.length === 0 ? <Empty message="No featured gigs" /> : (
            items.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                <div className="min-w-0"><div className="truncate text-sm font-bold">{g.title}</div><div className="text-[11px] text-muted-foreground">{formatEtb(g.startingPriceEtb)} · until {g.featuredUntil ? new Date(g.featuredUntil).toLocaleDateString() : '—'}</div></div>
                {g.isFeatured
                  ? <Button size="sm" variant="outline" disabled={unfeature.isPending} onClick={() => unfeature.mutate(g.id)}>Remove</Button>
                  : <Button size="sm" variant="brand" disabled={feature.isPending} onClick={() => feature.mutate({ id: g.id, days: 7 })}>Feature 7d</Button>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
