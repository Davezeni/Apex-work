'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface SavedGig {
  id: string;
  createdAt: string;
  gig: {
    id: string;
    slug: string;
    title: string;
    coverImageUrl: string | null;
    categoryId: string;
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    rating: number;
    ratingCount: number;
    startingPriceEtb: number;
    owner: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl: string | null;
      city: string | null;
    };
  };
}

export function useSavedGigs() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ items: SavedGig[] }>({
    queryKey: ['saved-gigs'],
    queryFn: () => apiFetch('/me/saved-gigs', { token }),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useSavedGigStatus(slug: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ saved: boolean }>({
    queryKey: ['saved-gig-status', slug],
    queryFn: () => apiFetch(`/me/saved-gigs/${encodeURIComponent(slug!)}`, { token }),
    enabled: !!token && !!slug,
    staleTime: 30_000,
  });
}

export function useSaveGig() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<{ saved: true }, Error, string>({
    mutationFn: (slug) =>
      apiFetch(`/me/saved-gigs/${encodeURIComponent(slug)}`, { method: 'PUT', token }),
    onSuccess: (_result, slug) => {
      qc.setQueryData(['saved-gig-status', slug], { saved: true });
      qc.invalidateQueries({ queryKey: ['saved-gigs'] });
    },
  });
}

export function useUnsaveGig() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<{ saved: false }, Error, string>({
    mutationFn: (slug) =>
      apiFetch(`/me/saved-gigs/${encodeURIComponent(slug)}`, { method: 'DELETE', token }),
    onSuccess: (_result, slug) => {
      qc.setQueryData(['saved-gig-status', slug], { saved: false });
      qc.invalidateQueries({ queryKey: ['saved-gigs'] });
    },
  });
}
