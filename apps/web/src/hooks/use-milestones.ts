'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { MilestoneInput } from '@apex-work/shared';

export interface Milestone {
  id: string;
  orderId: string;
  title: string;
  description: string | null;
  amountEtb: number;
  dueDate: string | null;
  position: number;
  status: 'PENDING' | 'DELIVERED' | 'APPROVED' | 'DISPUTED';
  deliveredAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useMilestones(orderId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: Milestone[] }>({
    queryKey: ['milestones', orderId],
    queryFn: () => apiFetch(`/orders/${orderId}/milestones`, { token }),
    enabled: !!token && !!orderId,
  });
}

export function useSetMilestones(orderId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<{ items: Milestone[] }, Error, MilestoneInput[]>({
    mutationFn: (milestones) =>
      apiFetch(`/orders/${orderId}/milestones`, {
        method: 'PUT',
        token,
        body: { milestones },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', orderId] });
      qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}

export function useMilestoneAction(orderId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<
    Milestone,
    Error,
    { id: string; action: 'deliver' | 'approve' | 'dispute'; reason?: string }
  >({
    mutationFn: ({ id, action, reason }) =>
      apiFetch(`/milestones/${id}/${action}`, {
        method: 'POST',
        token,
        body: reason ? { reason } : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', orderId] });
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}
