'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { CreateTicketInput, AddTicketMessageInput } from '@apex-work/shared';

export interface SupportTicket {
  id: string; subject: string; category: string;
  status: 'OPEN' | 'WAITING_USER' | 'WAITING_STAFF' | 'RESOLVED' | 'CLOSED';
  createdAt: string; updatedAt: string;
  user?: { id: string; username: string; fullName: string; avatarUrl: string | null };
  messages?: { id: string; ticketId: string; senderId: string; body: string; isStaff: boolean; createdAt: string }[];
}

export function useMyTickets() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: SupportTicket[] }>({
    queryKey: ['support', 'me'],
    queryFn: () => apiFetch('/support', { token }),
    enabled: !!token,
  });
}

export function useTicket(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<SupportTicket>({
    queryKey: ['support', id],
    queryFn: () => apiFetch(`/support/${id}`, { token }),
    enabled: !!token && !!id,
    refetchInterval: 15_000,
  });
}

export function useCreateTicket() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<SupportTicket, Error, CreateTicketInput>({
    mutationFn: (body) => apiFetch('/support', { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'me'] }),
  });
}

export function useReplyTicket(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, AddTicketMessageInput>({
    mutationFn: (body) => apiFetch(`/support/${id}/messages`, { method: 'POST', token, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', id] });
      qc.invalidateQueries({ queryKey: ['support', 'me'] });
    },
  });
}

export function useSetTicketStatus(id: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, SupportTicket['status']>({
    mutationFn: (status) => apiFetch(`/support/${id}/status`, { method: 'POST', token, body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', id] }),
  });
}
