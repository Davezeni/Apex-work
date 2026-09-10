'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { track } from '@/lib/analytics';

export type OrderStatus =
  'PENDING' | 'ACTIVE' | 'IN_REVIEW' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

export interface OrderPartyMini {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  title: string;
  amountEtb: number;
  sellerNetEtb: number;
  status: OrderStatus;
  deliveryDays: number;
  deadline: string | null;
  createdAt: string;
  gig: { slug: string; coverImageUrl: string | null } | null;
  client: OrderPartyMini;
  seller: OrderPartyMini;
}

export interface OrderDetail extends OrderSummary {
  packageTier: 'BASIC' | 'STANDARD' | 'PREMIUM' | null;
  requirements: string | null;
  deliverables: { notes?: string; files?: string[] } | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  platformFeeEtb: number;
  payments: {
    id: string;
    amountEtb: number;
    provider: string;
    method: string | null;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    createdAt: string;
  }[];
  gig: { slug: string; title: string; coverImageUrl: string | null } | null;
  milestones?: {
    id: string;
    title: string;
    amountEtb: number;
    status: 'PENDING' | 'DELIVERED' | 'APPROVED' | 'DISPUTED';
    dueDate: string | null;
  }[];
}

export function useMyOrders(role: 'client' | 'seller' = 'client') {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: OrderSummary[] }>({
    queryKey: ['orders', role],
    queryFn: () => apiFetch(`/orders?as=${role}`, { token }),
    enabled: !!token,
    staleTime: 15 * 1000,
  });
}

export function useOrder(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<OrderDetail>({
    queryKey: ['order', id],
    queryFn: () => apiFetch(`/orders/${id}`, { token }),
    enabled: !!token && !!id,
    staleTime: 5 * 1000,
  });
}

export function useCreateOrder() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      gigId: string;
      packageTier: 'BASIC' | 'STANDARD' | 'PREMIUM';
      requirements?: string;
    }) =>
      apiFetch<{ order: OrderSummary; checkoutUrl: string | null; devSkipped?: boolean }>(
        '/orders',
        { method: 'POST', body: input, token },
      ),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      track('order_request', {
        gigId: vars.gigId,
        packageTier: vars.packageTier,
        checkoutUrl: !!data.checkoutUrl,
        devSkipped: !!data.devSkipped,
      });
    },
  });
}

export function useOrderAction(orderId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) =>
      apiFetch<OrderDetail>(`/orders/${orderId}/actions`, {
        method: 'POST',
        body: input,
        token,
      }),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      const action = (vars as { action?: string })?.action;
      const status = data.status;
      track('order_action', { action, status, orderId });
    },
  });
}

/** Force server-side verify after user returns from Chapa. */
export function useVerifyPayment() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<{ order: OrderDetail; updated: boolean }>(`/orders/${orderId}/verify`, {
        method: 'POST',
        token,
      }),
    onSuccess: (_data, orderId) => {
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
