'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';

const tone: Record<string, 'ok' | 'warn' | 'neutral' | 'info' | 'bad'> = {
  OPEN: 'warn', WAITING_USER: 'info', WAITING_STAFF: 'warn', RESOLVED: 'ok', CLOSED: 'neutral',
};

export function SupportTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<any>(null);
  const [reply, setReply] = useState('');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/tickets', status],
    queryFn: () => apiFetch(`/admin/ops/tickets?limit=30${status ? `&status=${status}` : ''}`, { token }),
  });
  const replyMut = useMutation({
    mutationFn: () => apiFetch(`/admin/ops/tickets/${open!.id}/reply`, { method: 'POST', token, body: { body: reply } }),
    onSuccess: () => { toast.success('Reply sent'); setReply(''); qc.invalidateQueries({ queryKey: ['admin/tickets'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const statusMut = useMutation({
    mutationFn: (s: string) => apiFetch(`/admin/ops/tickets/${open!.id}/status`, { method: 'POST', token, body: { status: s } }),
    onSuccess: (d: any) => { toast.success('Ticket updated'); setOpen({ ...open, status: d.status }); qc.invalidateQueries({ queryKey: ['admin/tickets'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-5">
      <SectionHead title="Support" subtitle="Customer support ticket queue" />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inputCls, 'w-auto')}>
        <option value="">All statuses</option>
        {Object.keys(tone).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {isLoading ? <Spinner label="Loading tickets…" /> : items.length === 0 ? <Empty message="No tickets" /> : (
        <TableShell>
          <thead><tr><Th>Subject</Th><Th>User</Th><Th>Status</Th><Th>Messages</Th><Th>Open</Th></tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-b border-border/50">
                <Td className="max-w-[240px]"><div className="truncate font-bold">{t.subject}</div><div className="text-[11px] text-muted-foreground">{t.category}</div></Td>
                <Td className="text-muted-foreground">@{t.user?.username}</Td>
                <Td><Badge tone={tone[t.status] ?? 'neutral'}>{t.status}</Badge></Td>
                <Td className="text-muted-foreground">{t._count?.messages ?? 0}</Td>
                <Td><Button size="sm" variant="outline" onClick={() => { setOpen(t); setReply(''); }}>Open</Button></Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div><h3 className="text-base font-extrabold">{open.subject}</h3><p className="text-[11px] text-muted-foreground">@{open.user?.username} · {open.category}</p></div>
              <Badge tone={tone[open.status] ?? 'neutral'}>{open.status}</Badge>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-sm">
              {open.messages?.length ? open.messages.map((m: any) => (
                <div key={m.id} className={cn('rounded-lg px-3 py-2', m.isStaff ? 'bg-primary/10 text-right' : 'bg-background')}>
                  {m.isStaff && <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Staff</div>}
                  {m.body}
                </div>
              )) : <p className="text-center text-muted-foreground">No messages yet</p>}
            </div>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Type a reply…" className={inputCls} />
            <div className="flex justify-between gap-2">
              <div className="flex gap-2">
                {open.status !== 'RESOLVED' && open.status !== 'CLOSED' && <Button size="sm" variant="brand" disabled={statusMut.isPending} onClick={() => statusMut.mutate('RESOLVED')}>Resolve</Button>}
                <Button size="sm" variant="ghost" disabled={statusMut.isPending} onClick={() => statusMut.mutate('CLOSED')}>Close</Button>
              </div>
              <Button size="sm" variant="default" disabled={!reply.trim() || replyMut.isPending} onClick={() => replyMut.mutate()}>{replyMut.isPending ? 'Sending…' : 'Send reply'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
