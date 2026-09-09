'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiFetch } from '@/lib/api';
import { formatEtb, cn, timeAgo } from '@/lib/utils';
import { SectionHead, Badge, Spinner, Empty, TableShell, Th, Td, inputCls } from './admin-ui';
interface Agency {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  website: string | null;
  createdAt: string;
  owner: { id: string; username: string; fullName: string };
  _count: { members: number };
}
interface AgencyMember {
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    rating: number;
    completedOrders: number;
  };
}

export function AgenciesTab() {
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useQuery<{ items: Agency[] }>({
    queryKey: ['admin/agencies'],
    queryFn: () => apiFetch('/admin/ops/agencies?limit=100', { token }),
  });
  return (
    <div className="space-y-4">
      <SectionHead title={dt('Agencies')} subtitle={dt('Teams & agencies on the marketplace')} />
      {isLoading ? (
        <Spinner label={dt('Loading agencies…')} />
      ) : !data?.items?.length ? (
        <Empty message="No agencies yet" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.items.map((a) => (
            <AgencyCard key={a.id} agency={a} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgencyCard({ agency, token }: { agency: Agency; token: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading } = useQuery<{
    id: string;
    name: string;
    owner: { fullName: string; username: string; email: string };
    members: AgencyMember[];
  }>({
    queryKey: ['admin/agencies', agency.id],
    queryFn: () => apiFetch(`/admin/ops/agencies/${agency.id}`, { token }),
    enabled: open,
  });
  const setRole = useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      apiFetch(`/admin/ops/agencies/${agency.id}/members/${input.userId}`, {
        method: 'POST',
        token,
        body: { role: input.role },
      }),
    onSuccess: () => {
      toast.success(dt('Member role updated'));
      qc.invalidateQueries({ queryKey: ['admin/agencies', agency.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-extrabold">{agency.name}</div>
          <div className="text-[10px] text-muted-foreground">
            @{agency.slug} · {agency.owner.fullName} · {agency._count.members} member(s)
          </div>
        </div>
        <Badge tone="info">{agency._count.members}</Badge>
      </div>
      {agency.bio && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{agency.bio}</p>
      )}
      <div className="mt-2 text-[10px] text-muted-foreground">
        Created {timeAgo(agency.createdAt)}
      </div>
      <button
        onClick={() => setOpen(!open)}
        className="mt-3 text-[11px] font-bold text-primary hover:underline"
      >
        {open ? 'Hide members' : 'View members'}
      </button>
      {open &&
        (isLoading ? (
          <Spinner label={dt('Loading…')} />
        ) : (
          <div className="mt-3 space-y-2">
            {detail?.members?.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{m.user.fullName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    @{m.user.username} · ⭐{m.user.rating.toFixed(1)} · {m.user.completedOrders}{' '}
                    orders
                  </div>
                </div>
                <select
                  value={m.role}
                  disabled={setRole.isPending}
                  onChange={(e) => setRole.mutate({ userId: m.userId, role: e.target.value })}
                  className={cn(inputCls, 'w-auto px-2 py-1 text-[11px]')}
                >
                  <option value="MEMBER">{dt('Member')}</option>
                  <option value="ADMIN">{dt('Admin')}</option>
                  <option value="OWNER">{dt('Owner')}</option>
                </select>
              </div>
            ))}
            {!detail?.members?.length && <Empty message="No members" />}
          </div>
        ))}
    </div>
  );
}
