'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';
import { allCapabilitiesForRole } from './rbac';

const roleTone: Record<string, 'bad' | 'info' | 'ok' | 'warn' | 'neutral'> = {
  ADMIN: 'bad', MODERATOR: 'info', SUPPORT: 'warn', FINANCE: 'ok',
};

export function AdminsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/admins'],
    queryFn: () => apiFetch('/admin/ops/admins', { token }),
  });
  const roleMut = useMutation({
    mutationFn: (vars: { userId: string; role: string }) => apiFetch(`/admin/ops/users/${vars.userId}/role`, { method: 'POST', token, body: { role: vars.role } }),
    onSuccess: () => { toast.success('Role updated'); qc.invalidateQueries({ queryKey: ['admin/admins'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const items: any[] = (data?.items ?? []).filter((u: any) =>
    !search || u.fullName?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <SectionHead title="Admin team" subtitle="Staff roles & permissions (RBAC)" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className={cn(inputCls, 'w-64')} />
      {isLoading ? <Spinner label="Loading…" /> : items.length === 0 ? <Empty message="No staff found" /> : (
        <TableShell>
          <thead><tr><Th>Staff</Th><Th>Email</Th><Th>Role</Th><Th>Capabilities</Th><Th>Change role</Th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-border/50">
                <Td><div className="font-bold">{u.fullName} (@{u.username})</div><div className="text-[11px] text-muted-foreground">{u.isActive ? 'active' : 'suspended'}</div></Td>
                <Td className="text-muted-foreground">{u.email ?? '—'}</Td>
                <Td><Badge tone={roleTone[u.role] ?? 'neutral'}>{u.role}</Badge></Td>
                <Td className="max-w-[220px]"><div className="line-clamp-2 text-[11px] text-muted-foreground">{allCapabilitiesForRole(u.role).join(', ')}</div></Td>
                <Td>
                  <select value={u.role} className={cn(inputCls, 'w-auto py-1 text-xs')} disabled={roleMut.isPending}
                    onChange={(e) => roleMut.mutate({ userId: u.id, role: e.target.value })}>
                    {['ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE', 'CLIENT', 'FREELANCER'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
