'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';
import { allCapabilitiesForRole } from './rbac';
const roleTone: Record<string, 'bad' | 'info' | 'ok' | 'warn' | 'neutral'> = {
  ADMIN: 'bad',
  MODERATOR: 'info',
  SUPPORT: 'warn',
  FINANCE: 'ok',
};
const STAFF_ROLES = ['ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE'];

export function AdminsTab() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('MODERATOR');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/admins'],
    queryFn: () => apiFetch('/admin/ops/admins', { token }),
  });
  const roleMut = useMutation({
    mutationFn: (vars: { userId: string; role: string }) =>
      apiFetch(`/admin/ops/users/${vars.userId}/role`, {
        method: 'POST',
        token,
        body: { role: vars.role },
      }),
    onSuccess: () => {
      toast.success(dt('Role updated'));
      qc.invalidateQueries({ queryKey: ['admin/admins'] });
      qc.invalidateQueries({ queryKey: ['admin/staff-search'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Search all users (incl. non-staff) to promote someone to staff.
  const { data: results, isFetching } = useQuery<any>({
    queryKey: ['admin/staff-search', query],
    queryFn: () => apiFetch(`/admin/ops/users?q=${encodeURIComponent(query)}`, { token }),
    enabled: !!token && addOpen && query.trim().length >= 2,
    staleTime: 10_000,
  });
  const candidates: any[] = (results?.items ?? []).filter(
    (u: any) => !STAFF_ROLES.includes(u.role),
  );
  // Keep the results list fresh after a promotion.
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['admin/staff-search', query] });
  }, [query, qc]);

  const items: any[] = (data?.items ?? []).filter(
    (u: any) =>
      !search ||
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <SectionHead
        title={dt('Admin team')}
        subtitle={dt('Staff roles & permissions (RBAC)')}
        actions={
          <Button size="sm" variant="brand" onClick={() => setAddOpen((v) => !v)}>
            <UserPlus className="mr-1 h-4 w-4" /> Add staff
          </Button>
        }
      />

      {addOpen && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-extrabold">{dt('Add a staff member')}</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dt('Search by username, phone or email…')}
              className={cn(inputCls, 'min-w-0 flex-1')}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={cn(inputCls, 'w-auto')}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Pick a user below and assign a staff role. The chosen role determines their
            capabilities.
          </div>
          {isFetching ? (
            <Spinner label={dt('Searching…')} />
          ) : query.trim().length >= 2 && candidates.length === 0 ? (
            <Empty message="No eligible users found (they may already be staff)" />
          ) : null}
          {candidates.length > 0 && (
            <div className="divide-y divide-border/50 rounded-xl border border-border">
              {candidates.slice(0, 8).map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 p-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">
                      {u.fullName} <span className="text-muted-foreground">@{u.username}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {u.email ?? u.phone ?? '—'} · {u.role}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="brand"
                    disabled={roleMut.isPending}
                    onClick={() => roleMut.mutate({ userId: u.id, role })}
                  >
                    {roleMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      `Make ${role}`
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={dt('Search staff…')}
        className={cn(inputCls, 'w-64')}
      />
      {isLoading ? (
        <Spinner label={dt('Loading…')} />
      ) : items.length === 0 ? (
        <Empty message="No staff found" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>{dt('Staff')}</Th>
              <Th>{dt('Email')}</Th>
              <Th>{dt('Role')}</Th>
              <Th>{dt('Capabilities')}</Th>
              <Th>{dt('Change role')}</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-border/50">
                <Td>
                  <div className="font-bold">
                    {u.fullName} (@{u.username})
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {u.isActive ? 'active' : 'suspended'}
                  </div>
                </Td>
                <Td className="text-muted-foreground">{u.email ?? '—'}</Td>
                <Td>
                  <Badge tone={roleTone[u.role] ?? 'neutral'}>{u.role}</Badge>
                </Td>
                <Td className="max-w-[220px]">
                  <div className="line-clamp-2 text-[11px] text-muted-foreground">
                    {allCapabilitiesForRole(u.role).join(', ')}
                  </div>
                </Td>
                <Td>
                  <select
                    value={u.role}
                    className={cn(inputCls, 'w-auto py-1 text-xs')}
                    disabled={roleMut.isPending}
                    onChange={(e) => roleMut.mutate({ userId: u.id, role: e.target.value })}
                  >
                    {['ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE', 'CLIENT', 'FREELANCER'].map(
                      (r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ),
                    )}
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
