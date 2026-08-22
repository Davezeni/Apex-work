'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface SimilarGig {
  id: string; slug: string; title: string; coverImageUrl: string | null;
  startingPriceEtb: number; rating: number; ratingCount: number;
  owner: { username: string; fullName: string; avatarUrl: string | null };
}

export function useSimilarGigs(slug: string | undefined) {
  return useQuery<{ items: SimilarGig[] }>({
    queryKey: ['similar-gigs', slug],
    queryFn: () => apiFetch(`/gigs/${slug}/similar`),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}
