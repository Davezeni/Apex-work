'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens } from '@apex-work/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  setSession: (tokens: AuthTokens) => void;
  clear: () => void;
  isAuthed: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      setSession: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        }),
      clear: () => set({ accessToken: null, refreshToken: null, expiresAt: null }),
      isAuthed: () => {
        const s = get();
        return !!s.accessToken && !!s.expiresAt && Date.now() < s.expiresAt;
      },
    }),
    {
      name: 'apex-work-auth',
      // Access token in localStorage is a trade-off for MVP; move to httpOnly cookie later
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt }),
    },
  ),
);
