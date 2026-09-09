'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/auth/otp-input';
import { apiFetch, ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-me';
import { useAuthStore } from '@/stores/auth-store';
import { ETHIOPIAN_PHONE_REGEX, OTP_LENGTH } from '@apex-work/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
type Step = 'phone' | 'otp';

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function VerifyPhonePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const { data: me, isLoading, isAuthed } = useMe();
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const next = safeNext(params.get('next'));
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+251');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthed)
      router.replace(`/login?next=${encodeURIComponent('/settings/phone')}`);
  }, [isLoading, isAuthed, router]);

  useEffect(() => {
    if (me?.phone) setPhone(me.phone);
  }, [me?.phone]);

  const sendCode = async (resend = false) => {
    if (!ETHIOPIAN_PHONE_REGEX.test(phone)) {
      toast.error(t('auth.invalidPhone'));
      return;
    }
    setLoading(!resend);
    setResending(resend);
    try {
      await apiFetch('/auth/otp/request', {
        method: 'POST',
        body: { phone, purpose: 'RESET' },
      });
      setStep('otp');
      setCode('');
      toast.success(resend ? t('auth.codeResent') : t('auth.codeSent'));
    } catch (error) {
      toast.error((error as ApiError).message ?? 'Could not send verification code');
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const verifyingRef = useRef(false);
  const verify = async (submittedCode?: string) => {
    const value = submittedCode ?? code;
    if (value.length !== OTP_LENGTH || !token) return;
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    try {
      const { verifiedToken } = await apiFetch<{ verifiedToken: string }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code: value },
      });
      await apiFetch('/me/phone', {
        method: 'PATCH',
        token,
        body: { phone, otpToken: verifiedToken },
      });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success(dt('Phone verified successfully'));
      router.replace(next);
    } catch (error) {
      setCode('');
      toast.error((error as ApiError).message ?? 'Phone verification failed');
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mesh-bg flex min-h-dvh flex-col">
      <header className="safe-top flex items-center gap-3 p-5">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{dt('Verify phone')}</span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-10">
        <div className="grad-hero grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/30">
          <ShieldCheck className="h-7 w-7" />
        </div>
        {step === 'phone' ? (
          <>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
              {dt('Add your phone number')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Verify an Ethiopian mobile number to unlock ordering, messaging, posting, payouts, and
              account recovery.
            </p>
            <label className="mt-8 block text-xs font-semibold text-muted-foreground">
              Ethiopian phone number
            </label>
            <div className="relative mt-2">
              <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={dt('+2519XXXXXXXX')}
                className="h-14 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-lg font-medium tracking-wider outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
            </div>
            <Button
              variant="brand"
              size="lg"
              className="mt-6 w-full"
              onClick={() => void sendCode()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Send verification code <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
              {dt('Enter verification code')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We sent a code to <span className="font-semibold text-foreground">{phone}</span>.
            </p>
            <OtpInput
              phone={phone}
              code={code}
              onChange={(value) => {
                setCode(value);
                if (value.length === OTP_LENGTH) void verify(value);
              }}
              onResend={() => void sendCode(true)}
              resending={resending}
            />
            <Button
              variant="brand"
              size="lg"
              className="mt-6 w-full"
              onClick={() => void verify()}
              disabled={loading || code.length !== OTP_LENGTH}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Verify phone <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <button
              onClick={() => setStep('phone')}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground"
            >
              Use a different number
            </button>
          </>
        )}
      </main>
    </div>
  );
}
