'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface RecommendedJob {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  budgetMinEtb: number | null;
  budgetMaxEtb: number | null;
  requiredSkills: string[];
  isRemote: boolean;
  createdAt: string;
  matchScore: number;
  matchedSkills: string[];
  client: { username: string; fullName: string; avatarUrl: string | null };
}

export interface RecommendedGig {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  categoryId: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  startingPriceEtb: number;
  matchScore: number;
  matchedSkills: string[];
  owner: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    city: string | null;
  };
}

export function useRecommendations() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<
    | { kind: 'jobs'; items: RecommendedJob[]; basedOn: string[] }
    | { kind: 'gigs'; items: RecommendedGig[]; basedOn: string[] }
  >({
    queryKey: ['recommendations'],
    queryFn: () => apiFetch('/recommendations', { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
}
