'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { OpenDisputeInput, ResolveDisputeInput } from '@apex-work/shared';

export interface Dispute {
  id: string; orderId: string; openedById: string; reason: string;
  status: 'OPEN' | 'REVIEWING' | 'RESOLVED_CLIENT' | 'RESOLVED_SELLER' | 'RESOLVED_SPLIT' | 'WITHDRAWN';
  clientPayoutEtb: number | null; sellerPayoutEtb: number | null;
  adminNotes: string | null;
  createdAt: string; resolvedAt: string | null;
  order?: {
    id: string; title: string; amountEtb: number; sellerNetEtb: number; platformFeeEtb: number;
    clientId: string; sellerId: string;
    client: { username: string; fullName: string; avatarUrl: string | null };
    seller: { username: string; fullName: string; avatarUrl: string | null };
  };
  openedBy?: { username: string; fullName: string; avatarUrl?: string | null };
}

export function useMyDisputes() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: Dispute[] }>({
    queryKey: ['disputes', 'me'],
    queryFn: () => apiFetch('/disputes', { token }),
    enabled: !!token,
  });
}

export function useOpenDispute() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<Dispute, Error, OpenDisputeInput>({
    mutationFn: (body) => apiFetch('/disputes', { method: 'POST', token, body }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['disputes', 'me'] });
      qc.invalidateQueries({ queryKey: ['order', d.orderId] });
    },
  });
}

// Admin
export function useAdminDisputes(status?: string) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: Dispute[] }>({
    queryKey: ['admin', 'disputes', status ?? 'ALL'],
    queryFn: () => apiFetch(`/admin/disputes${status ? `?status=${status}` : ''}`, { token }),
    enabled: !!token,
  });
}

export function useResolveDispute() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<Dispute, Error, { id: string } & ResolveDisputeInput>({
    mutationFn: ({ id, ...body }) => apiFetch(`/admin/disputes/${id}/resolve`, { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }),
  });
}
