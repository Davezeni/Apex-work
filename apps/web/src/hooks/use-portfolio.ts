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

export function useUpdatePortfolioItem() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title?: string; description?: string; externalUrl?: string; imageUrl?: string }) => {
      const { id, ...body } = input;
      return apiFetch<PortfolioItem>(`/me/portfolio/${id}`, { method: 'PATCH', token, body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-portfolio'] });
      qc.invalidateQueries({ queryKey: ['public-user'] });
    },
  });
}

export function useReorderPortfolio() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ ok: true }>('/me/portfolio/reorder', { method: 'POST', token, body: { ids } }),
    // Optimistic reorder: reorder locally *before* the request lands so drag feels instant.
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['my-portfolio'] });
      const prev = qc.getQueryData<{ items: PortfolioItem[] }>(['my-portfolio']);
      if (prev) {
        const byId = new Map(prev.items.map((i) => [i.id, i]));
        const reordered = ids.map((id) => byId.get(id)).filter(Boolean) as PortfolioItem[];
        qc.setQueryData(['my-portfolio'], { items: reordered });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['my-portfolio'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['my-portfolio'] }),
  });
}

export interface PublicPortfolioItem extends PortfolioItem {
  owner: { id: string; username: string; fullName: string; avatarUrl: string | null; title: string | null };
}

export function usePublicPortfolioItem(username: string | undefined, id: string | undefined) {
  return useQuery<PublicPortfolioItem>({
    queryKey: ['portfolio-item', username, id],
    queryFn: () => apiFetch(`/users/${username}/portfolio/${id}`),
    enabled: !!username && !!id,
    staleTime: 5 * 60 * 1000,
  });
}
