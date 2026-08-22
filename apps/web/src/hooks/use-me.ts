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
    // /me carries role + verification flags + wallet-relevant state — we
    // need it fresh whenever a page mounts (e.g. after an admin promotes
    // the user). Override the app-wide `refetchOnMount: false` here.
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
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

/**
 * Sign out.
 *
 * By default we KEEP the trusted-device token so the user can sign back in
 * with one tap (Telegram / WhatsApp behaviour). Callers that want a full
 * scrub — e.g. "Forget this device" on a shared computer — should call
 * `logout(true)`.
 */
export function useLogout() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const clearAndForgetDevice = useAuthStore((s) => s.clearAndForgetDevice);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<{ forgetDevice: boolean }, unknown, boolean | undefined>({
    mutationFn: async (forgetDevice) => {
      // Best-effort: revoke the refresh token so it can't be reused server-side.
      // Never let a network error block the client-side logout.
      if (refreshToken) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
        }).catch(() => undefined);
      }
      return { forgetDevice: !!forgetDevice };
    },
    onSettled: (data) => {
      if (data?.forgetDevice) clearAndForgetDevice();
      else clear();
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
