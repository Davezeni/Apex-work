'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface GigAnalytics {
  gig: { id: string; title: string; slug: string };
  range: string;
  kpis: {
    views: number;
    contacts: number;
    starts: number;
    orders: number;
    completed: number;
    viewToContact: number;
    contactToOrder: number;
    completionRate: number;
  };
  series: { day: string; views: number }[];
}

export function useGigAnalytics(slug: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<GigAnalytics>({
    queryKey: ['gig', slug, 'analytics'],
    queryFn: () => apiFetch(`/gigs/${slug}/analytics`, { token }),
    enabled: !!token && !!slug,
    staleTime: 60_000,
  });
}

/** Fire-and-forget event ping — never blocks the UI. */
export async function recordGigEvent(
  slug: string,
  type: 'VIEW' | 'CONTACT' | 'ORDER_START',
  token?: string | null,
) {
  try {
    await apiFetch(`/gigs/${slug}/event`, {
      method: 'POST',
      body: { type },
      token: token ?? undefined,
    });
  } catch {
    /* ignore — analytics failures never disrupt UX */
  }
}
