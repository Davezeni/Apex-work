'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';

export function AuditTab() {
  const token = useAuthStore((s) => s.accessToken);
  const [resourceType, setResourceType] = useState('');
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin/audit', resourceType],
    queryFn: () => apiFetch(`/admin/ops/audit?limit=40${resourceType ? `&resourceType=${resourceType}` : ''}`, { token }),
  });
  const items: any[] = data?.items ?? [];
  return (
    <div className="space-y-4">
      <SectionHead title="Audit log" subtitle="Every admin mutation, who/what/when" />
      <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className={cn(inputCls, 'w-auto')}>
        <option value="">All resource types</option>
        {['GIG', 'JOB', 'REVIEW', 'ORDER', 'WALLET', 'WITHDRAWAL', 'USER', 'TICKET', 'SETTING', 'SYSTEM'].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {isLoading ? <Spinner label="Loading audit…" /> : items.length === 0 ? <Empty message="No audit entries" /> : (
        <TableShell>
          <thead><tr><Th>Admin</Th><Th>Action</Th><Th>Resource</Th><Th>When</Th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b border-border/50">
                <Td><div className="font-bold">{a.adminName}</div><div className="text-[11px] text-muted-foreground">{a.adminRole}</div></Td>
                <Td><Badge tone="info">{a.action}</Badge></Td>
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
