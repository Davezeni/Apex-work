'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export function useBoostGig() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, { slug: string; days: number }>({
    mutationFn: ({ slug, days }) =>
      apiFetch(`/gigs/${slug}/boost`, { method: 'POST', token, body: { days } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gigs'] });
      qc.invalidateQueries({ queryKey: ['gig'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}
