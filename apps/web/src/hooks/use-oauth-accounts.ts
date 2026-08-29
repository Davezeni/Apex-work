'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { OAuthProvider } from '@apex-work/shared';

export interface OAuthAccount {
  provider: OAuthProvider;
  email: string | null;
  profileName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export function useOAuthAccounts() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery<{ items: OAuthAccount[] }>({
    queryKey: ['oauth-accounts'],
    queryFn: () => apiFetch('/me/oauth-accounts', { token }),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useUnlinkOAuthAccount() {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  return useMutation<{ ok: true; provider: OAuthProvider }, Error, OAuthProvider>({
    mutationFn: (provider) =>
      apiFetch(`/me/oauth-accounts/${provider}`, { method: 'DELETE', token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-accounts'] });
    },
  });
}

/** Start an authenticated provider-link flow without creating a second account. */
export function useStartOAuthLink(next = '/settings/connected') {
  const token = useAuthStore((state) => state.accessToken);
  return useMutation<{ authorizationUrl: string }, Error, OAuthProvider>({
    mutationFn: (provider) => {
      const query = new URLSearchParams({ next });
      return apiFetch(`/auth/oauth/${provider}/link/start?${query.toString()}`, {
        method: 'POST',
        token,
      });
    },
  });
}
