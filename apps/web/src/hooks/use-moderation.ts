'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { CreateReportInput, CreateOfferInput } from '@apex-work/shared';

export function useCreateReport() {
  const token = useAuthStore((s) => s.accessToken);
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      apiFetch('/moderation/reports', { method: 'POST', token, body: input }),
  });
}

export function useBlockUser() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; reason?: string }) =>
      apiFetch('/moderation/blocks', { method: 'POST', token, body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
}

export function useUnblockUser() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/moderation/blocks/${userId}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
}

export interface BlockedRow {
  blockerId: string;
  blockedId: string;
  createdAt: string;
  reason: string | null;
  blocked: { id: string; username: string; fullName: string; avatarUrl: string | null };
}

export function useBlockedUsers() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: BlockedRow[] }>({
    queryKey: ['blocks'],
    queryFn: () => apiFetch('/moderation/blocks', { token }),
    enabled: !!token,
  });
}

// ---------------- Offers ----------------

export interface CustomOffer {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  gigId: string | null;
  title: string;
  description: string | null;
  priceEtb: number;
  deliveryDays: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  orderId: string | null;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string;
  sender: { id: string; username: string; fullName: string; avatarUrl: string | null };
  recipient: { id: string; username: string; fullName: string; avatarUrl: string | null };
}

export function useOffer(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<CustomOffer>({
    queryKey: ['offer', id],
    queryFn: () => apiFetch(`/offers/${id}`, { token }),
    enabled: !!token && !!id,
  });
}

export function useCreateOffer() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferInput) =>
      apiFetch<CustomOffer>('/offers', { method: 'POST', token, body: input }),
    onSuccess: (offer) => {
      qc.invalidateQueries({ queryKey: ['messages', offer.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useRespondOffer() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'accept' | 'decline' | 'cancel' }) =>
      apiFetch<{
        offer: CustomOffer;
        order?: { id: string };
        checkoutUrl?: string | null;
      }>(`/offers/${input.id}/respond`, {
        method: 'POST',
        token,
        body: { action: input.action },
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['offer', vars.id] });
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
