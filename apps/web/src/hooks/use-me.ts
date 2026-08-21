'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface Me {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string;
  avatarUrl: string | null;
  role: 'CLIENT' | 'FREELANCER' | 'ADMIN';
  bio: string | null;
  title: string | null;
  city: string | null;
  hourlyRateEtb: number | null;
  isVerified: boolean;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isIdVerified: boolean;
  isOnboarded: boolean;
  rating: number;
  ratingCount: number;
  completedOrders: number;
  createdAt: string;
}

/** Fetch the currently-authenticated user. */
export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const expiresAt = useAuthStore((s) => s.expiresAt);
  const clear = useAuthStore((s) => s.clear);

  const enabled = !!accessToken && !!expiresAt && Date.now() < expiresAt;

  const query = useQuery<Me, ApiError>({
    queryKey: ['me', accessToken],
    queryFn: () => apiFetch<Me>('/me', { token: accessToken }),
    enabled,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      if (error.status === 401) return false;
      return failureCount < 1;
    },
  });

  // On 401, wipe local state so subscribers see "logged out"
  useEffect(() => {
    if (query.error?.status === 401) {
      clear();
    }
  }, [query.error, clear]);

  return {
    ...query,
    isAuthed: enabled,
    /** true only when we've actually fetched and confirmed we're authed */
    isSignedIn: enabled && !!query.data,
  };
}

/** Logout mutation — calls API to revoke refresh token, then clears local state. */
export function useLogout() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      // Best-effort: revoke on server so the refresh token can't be reused.
      // Ignore errors — client-side logout must always succeed.
      if (refreshToken) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
        }).catch(() => undefined);
      }
    },
    onSettled: () => {
      // Always run these, even if the API call failed.
      clear();
      queryClient.clear();
      // Hard reload — guarantees every component re-reads from fresh state
      // and any stale in-memory data is gone.
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      } else {
        router.push('/login');
      }
    },
  });
}
