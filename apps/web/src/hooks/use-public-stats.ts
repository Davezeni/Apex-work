'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface PublicUserStats {
  role: 'CLIENT' | 'FREELANCER' | 'ADMIN' | null;
  memberSince: string | null;
  rating: number;
  ratingCount: number;
  completedOrders: number;
  asClient: { hires: number; totalSpentEtb: number };
  asFreelancer: { completedOrders: number; lifetimeEarnedEtb: number };
  availability: {
    hours?: Record<string, boolean[]>;
    timezone?: string;
    vacation?: boolean;
  } | null;
}

export function usePublicUserStats(username: string | undefined) {
  return useQuery<PublicUserStats>({
    queryKey: ['user', username, 'stats'],
    queryFn: () => apiFetch(`/users/${username}/stats`),
    enabled: !!username,
    staleTime: 60_000,
  });
}
