'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface GigTranslation {
  gigId: string;
  locale: string;
  title: string;
  description: string;
  updatedAt: string;
}

export function useGigTranslation(slug: string | undefined, locale: 'en' | 'am' | undefined) {
  return useQuery<GigTranslation | null>({
    queryKey: ['gig', slug, 'translation', locale],
    queryFn: () => apiFetch(`/gigs/${slug}/translation?locale=${locale}`),
    enabled: !!slug && !!locale,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTranslateGig(slug: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<GigTranslation & { source: 'ai' | 'fallback' }, Error, 'en' | 'am'>({
    mutationFn: (targetLocale) => apiFetch(`/gigs/${slug}/translate`, { method: 'POST', token, body: { targetLocale } }),
    onSuccess: (_r, locale) => qc.invalidateQueries({ queryKey: ['gig', slug, 'translation', locale] }),
  });
}
