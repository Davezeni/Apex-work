'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens } from '@apex-work/shared';
import { setDeviceToken, clearDeviceToken } from '@/lib/device';

/**
 * Enriched auth-token shape: the API optionally returns a `deviceToken` so
 * this browser can be marked trusted for 30 days (skip-OTP on repeat logins).
 * Also captures the last-used phone number for the "sign in as X" hint.
 */
export interface AuthSessionTokens extends AuthTokens {
  deviceToken?: string;
  deviceExpiresAt?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  /** Remembered phone for the login hint UI. Cleared on explicit "use different phone". */
  lastPhone: string | null;
  setSession: (tokens: AuthSessionTokens, phone?: string) => void;
  setLastPhone: (phone: string | null) => void;
  clear: () => void;
  /** Full "forget me on this device" — clears both the session AND the device token. */
  clearAndForgetDevice: () => void;
  isAuthed: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      lastPhone: null,
      setSession: (tokens, phone) => {
        // Device token lives in a separate storage key so it survives sign-out.
        if (tokens.deviceToken) setDeviceToken(tokens.deviceToken);
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
          ...(phone ? { lastPhone: phone } : {}),
        });
      },
      setLastPhone: (phone) => set({ lastPhone: phone }),
      clear: () => set({ accessToken: null, refreshToken: null, expiresAt: null }),
      clearAndForgetDevice: () => {
        clearDeviceToken();
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          lastPhone: null,
        });
      },
      isAuthed: () => {
        const s = get();
        return !!s.accessToken && !!s.expiresAt && Date.now() < s.expiresAt;
      },
    }),
    {
      name: 'apex-work-auth',
      // Access token in localStorage is a trade-off for MVP; move to httpOnly cookie later
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        expiresAt: s.expiresAt,
        lastPhone: s.lastPhone,
      }),
    },
  ),
);
