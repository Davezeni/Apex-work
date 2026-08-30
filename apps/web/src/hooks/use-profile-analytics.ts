'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface ProfileAnalytics {
  range: '30d';
  totals: {
    profileViews: number;
    cvViews: number;
    cvDownloads: number;
    portfolioViews: number;
    portfolioDownloads: number;
  };
  series: { day: string; events: number }[];
}

export function useProfileAnalytics() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<ProfileAnalytics>({
    queryKey: ['me', 'profile-analytics'],
    queryFn: () => apiFetch('/me/profile-analytics', { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
}
