'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export type OrderStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'IN_REVIEW'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

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
    mutationFn: (input: { gigId: string; packageTier: 'BASIC' | 'STANDARD' | 'PREMIUM'; requirements?: string }) =>
      apiFetch<{ order: OrderSummary; checkoutUrl: string | null; devSkipped?: boolean }>(
        '/orders',
        { method: 'POST', body: input, token },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
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
