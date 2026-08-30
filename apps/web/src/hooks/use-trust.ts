'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface TrustCheck {
  key: string;
  label: string;
  complete: boolean;
  weight: number;
  detail: string;
}

export interface TrustProfile {
  score: number;
  level: 'Elite' | 'Strong' | 'Growing' | 'New';
  checks: TrustCheck[];
  signals: {
    completedOrders: number;
    rating: number;
    ratingCount: number;
    onTimeRate: number | null;
    portfolioCount: number;
    verifiedCertifications: number;
  };
}

export function usePublicTrust(username: string | undefined) {
  return useQuery<TrustProfile>({
    queryKey: ['user', username, 'trust'],
    queryFn: () => apiFetch(`/users/${username}/trust`),
    enabled: !!username,
    staleTime: 120_000,
  });
}
