'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  externalUrl: string | null;
  position: number;
  createdAt: string;
}

export function useMyPortfolio() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: PortfolioItem[] }>({
    queryKey: ['my-portfolio'],
    queryFn: () => apiFetch('/me/portfolio', { token }),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useAddPortfolioItem() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      imageUrl: string;
      externalUrl?: string;
    }) =>
      apiFetch<PortfolioItem>('/me/portfolio', { method: 'POST', body: input, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-portfolio'] });
      qc.invalidateQueries({ queryKey: ['public-user'] });
    },
  });
}

export function useDeletePortfolioItem() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/me/portfolio/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-portfolio'] });
      qc.invalidateQueries({ queryKey: ['public-user'] });
    },
  });
}
