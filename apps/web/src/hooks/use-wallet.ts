'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { RequestWithdrawalInput } from '@apex-work/shared';

export interface WalletData {
  wallet: {
    id: string;
    balanceEtb: number;
    pendingEtb: number;
    lifetimeEarnedEtb: number;
    updatedAt: string;
  };
  transactions: {
    id: string;
    type:
      | 'ORDER_PAYMENT'
      | 'ORDER_PAYOUT'
      | 'ORDER_REFUND'
      | 'WITHDRAWAL'
      | 'PLATFORM_FEE'
      | 'REFERRAL_BONUS';
    amountEtb: number;
    description: string;
    relatedId: string | null;
    createdAt: string;
  }[];
}

export interface Withdrawal {
  id: string;
  amountEtb: number;
  feeEtb: number;
  netEtb: number;
  destination: string;
  accountNumber: string;
  accountName: string | null;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  processedAt: string | null;
  failureReason: string | null;
}

export function useWallet() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<WalletData>({
    queryKey: ['wallet'],
    queryFn: () => apiFetch('/me/wallet', { token }),
    enabled: !!token,
    staleTime: 15_000,
  });
}

export function useWithdrawals() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: Withdrawal[] }>({
    queryKey: ['withdrawals'],
    queryFn: () => apiFetch('/me/wallet/withdrawals', { token }),
    enabled: !!token,
    staleTime: 15_000,
  });
}

export function useRequestWithdrawal() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestWithdrawalInput) =>
      apiFetch<Withdrawal>('/me/wallet/withdrawals', { method: 'POST', token, body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['withdrawals'] });
    },
  });
}

export function useCancelWithdrawal() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Withdrawal>(`/me/wallet/withdrawals/${id}/cancel`, { method: 'POST', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['withdrawals'] });
    },
  });
}
