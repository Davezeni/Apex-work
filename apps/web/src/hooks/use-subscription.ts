'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface ProPlan {
  id: 'FREELANCER_PRO' | 'CLIENT_PRO';
  name: string;
  priceEtb: number;
  audience: string;
  features: string[];
}

export function useSubscription() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<{
    plan: 'FREE' | 'FREELANCER_PRO' | 'CLIENT_PRO';
    subscription: { id: string; plan: string; status: string; expiresAt: string | null } | null;
    plans: ProPlan[];
  }>({
    queryKey: ['subscription'],
    queryFn: () => apiFetch('/me/subscription', { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useBuyPro() {
  const token = useAuthStore((state) => state.accessToken);
  return useMutation<
    { owned: boolean; purchaseId?: string; plan: string; checkoutUrl: string | null },
    Error,
    'FREELANCER_PRO' | 'CLIENT_PRO'
  >({
    mutationFn: (plan) =>
      apiFetch('/me/subscription/checkout', { method: 'POST', token, body: { plan } }),
  });
}

export function useVerifyPro() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  return useMutation<
    { purchaseId: string; plan: string; status: string; active: boolean; expiresAt: string | null },
    Error,
    string
  >({
    mutationFn: (purchaseId) =>
      apiFetch('/me/subscription/verify', { method: 'POST', token, body: { purchaseId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
  });
}
