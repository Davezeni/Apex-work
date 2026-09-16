'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface SearchResults {
  gigs: {
    id: string;
    slug: string;
    title: string;
    coverImageUrl: string | null;
    startingPriceEtb: number;
    rating: number;
    ratingCount: number;
    owner: { username: string; fullName: string; avatarUrl: string | null };
  }[];
  jobs: {
    id: string;
    title: string;
    budgetMinEtb: number | null;
    budgetMaxEtb: number | null;
    isRemote: boolean;
    createdAt: string;
    client: { username: string; fullName: string };
  }[];
  users: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    title: string | null;
    city: string | null;
    rating: number;
    ratingCount: number;
    isVerified?: boolean;
  }[];
}

export function useGlobalSearch(q: string, limit = 8) {
  return useQuery<SearchResults>({
    queryKey: ['search', q, limit],
    queryFn: () => apiFetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export interface Suggestion {
  text: string;
  type: 'gig' | 'job' | 'skill' | 'user';
  ref?: string;
}

export function useSuggest(q: string) {
  return useQuery<{ items: Suggestion[] }>({
    queryKey: ['suggest', q],
    queryFn: () => apiFetch(`/search/suggest?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });
}
