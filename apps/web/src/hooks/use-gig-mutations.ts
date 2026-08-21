'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { CreateGigInput } from '@apex-work/shared';
import type { GigDetail } from './use-gigs';

/**
 * Create a new gig. Invalidates any list caches on success so the freelancer's
 * new gig shows up on the home feed immediately.
 */
export function useCreateGig() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGigInput) =>
      apiFetch<GigDetail>('/gigs', { method: 'POST', body: input, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gigs'] });
    },
  });
}
