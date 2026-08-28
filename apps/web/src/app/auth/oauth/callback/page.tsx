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
  const next = safeNext(params.get('next'));
  const error = params.get('oauthError');

  useEffect(() => {
    let cancelled = false;
    if (error || !handoff) {
      toast.error(error === 'provider_unavailable'
        ? 'This sign-in provider is not configured yet.'
        : 'OAuth sign-in could not be completed.');
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return () => { cancelled = true; };
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
        toast.success('Signed in successfully');
        if (requiresPhone) {
          router.replace(`/settings/phone?next=${encodeURIComponent(next)}`);
        } else {
          router.replace(next);
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        toast.error(reason instanceof ApiError ? reason.message : 'OAuth sign-in could not be completed.');
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      });

    return () => { cancelled = true; };
  }, [error, handoff, next, router, setSession]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div>
        <div className="grad-hero mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/30">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-semibold">Finishing secure sign-in…</p>
        <p className="mt-1 text-xs text-muted-foreground">You will be returned to Apex-Work in a moment.</p>
      </div>
    </div>
  );
}
