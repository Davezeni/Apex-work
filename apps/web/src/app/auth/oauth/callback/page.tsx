'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore, type AuthSessionTokens } from '@/stores/auth-store';

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function OAuthCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const handoff = params.get('handoff');
  const linked = params.get('linked');
  const next = safeNext(params.get('next'));
  const error = params.get('oauthError');
  const oauthMode = params.get('oauthMode');

  useEffect(() => {
    let cancelled = false;
    if (linked === 'google' || linked === 'github') {
      toast.success(`${linked === 'google' ? 'Google' : 'GitHub'} connected to this account`);
      router.replace(next);
      return () => {
        cancelled = true;
      };
    }

    if (error || !handoff) {
      const message =
        error === 'provider_unavailable'
          ? 'This sign-in provider is not configured yet.'
          : error === 'oauth_link_conflict'
            ? 'That provider account is already connected to another Apex-Work account.'
            : oauthMode === 'link'
              ? 'The provider could not be connected to this account.'
              : 'OAuth sign-in could not be completed.';
      toast.error(message);
      router.replace(oauthMode === 'link' ? next : `/login?next=${encodeURIComponent(next)}`);
      return () => {
        cancelled = true;
      };
    }

    apiFetch<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      deviceToken?: string;
      deviceExpiresAt?: string;
      phone: string | null;
      requiresPhone: boolean;
    }>('/auth/oauth/handoff', {
      method: 'POST',
      body: { handoff },
    })
      .then((result) => {
        if (cancelled) return;
        const { phone, requiresPhone, ...tokens } = result;
        setSession(tokens as AuthSessionTokens, phone ?? undefined);
        toast.success(
          requiresPhone
            ? 'Signed in. Verify your phone before high-trust actions.'
            : 'Signed in successfully',
        );
        // OAuth is allowed to create a basic account first. Phone verification
        // is a step-up at the point of posting, ordering, messaging, or payout;
        // do not force a duplicate OTP immediately after social sign-in.
        router.replace(next);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        toast.error(
          reason instanceof ApiError ? reason.message : 'OAuth sign-in could not be completed.',
        );
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [error, handoff, linked, next, oauthMode, router, setSession]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div>
        <div className="grad-hero mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/30">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-semibold">Finishing secure sign-in…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You will be returned to Apex-Work in a moment.
        </p>
      </div>
    </div>
  );
}
