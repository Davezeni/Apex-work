'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';
import { ExportButton } from './export-button';

const RESOURCE_TYPES = ['GIG', 'JOB', 'REVIEW', 'ORDER', 'WALLET', 'WITHDRAWAL', 'USER', 'TICKET', 'SETTING', 'SYSTEM'];

export function AuditTab() {
  const token = useAuthStore((s) => s.accessToken);
  const [resourceType, setResourceType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/audit', resourceType],
    queryFn: () => apiFetch(`/admin/ops/audit?limit=200${resourceType ? `&resourceType=${resourceType}` : ''}`, { token }),
  });

  // Client-side action filter, so we can surface the media-approval trail
  // (MEDIA.REMOVE_AVATAR / MEDIA.FLAG_GIG) as its own log without an extra query.
  const items: any[] = useMemo(() => {
    const all: any[] = data?.items ?? [];
    if (!actionFilter) return all;
    return all.filter((a) => (a.action ?? '').toUpperCase().includes(actionFilter.toUpperCase()));
  }, [data, actionFilter]);

  const mediaCount = (data?.items ?? []).filter((a: any) => /MEDIA\./.test(a.action ?? '')).length;

  return (
    <div className="space-y-4">
      <SectionHead
        title="Audit log"
        subtitle={
          mediaCount > 0
            ? `Every admin mutation — ${mediaCount} media actions (image approvals)`
            : 'Every admin mutation, who/what/when'
        }
        actions={<ExportButton kind="audit" params={resourceType ? { resourceType } : {}} />}
      />
      <div className="flex flex-wrap gap-2">
        <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className={cn(inputCls, 'w-auto')}>
          <option value="">All resource types</option>
          {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={cn(inputCls, 'w-auto')}>
          <option value="">All actions</option>
          <option value="MEDIA">Image approvals (MEDIA)</option>
          <option value="BULK">User imports</option>
          <option value="MODERATE">Gig moderate</option>
          <option value="SUSPEND">Suspensions</option>
          <option value="REFUND">Refunds</option>
        </select>
      </div>
      {isLoading ? <Spinner label="Loading audit…" /> : items.length === 0 ? <Empty message="No audit entries" /> : (
        <TableShell>
          <thead><tr><Th>Admin</Th><Th>Action</Th><Th>Resource</Th><Th>When</Th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b border-border/50">
                <Td><div className="font-bold">{a.adminName}</div><div className="text-[11px] text-muted-foreground">{a.adminRole}</div></Td>
                <Td><Badge tone={/MEDIA\./.test(a.action) ? 'warn' : 'info'}>{a.action}</Badge></Td>
                <Td><span className="text-muted-foreground">{a.resourceType}{a.resourceId ? ` · ${a.resourceId.slice(0, 8)}` : ''}</span></Td>
                <Td className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
