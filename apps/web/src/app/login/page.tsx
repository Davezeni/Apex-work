'use client';

import { dt } from '@/i18n/auto';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  UserPlus,
  LockKeyhole,
  Fingerprint,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GithubIcon, GoogleIcon } from '@/components/ui/brand-icons';
import { OtpInput } from '@/components/auth/otp-input';
import { BrandMark } from '@/components/brand/brand-logo';
import { PinInput } from '@/components/auth/pin-input';
import { apiFetch, ApiError } from '@/lib/api';
import { ETHIOPIAN_PHONE_REGEX, OTP_LENGTH } from '@apex-work/shared';
import { useAuthStore, type AuthSessionTokens } from '@/stores/auth-store';
import { getDeviceToken } from '@/lib/device';
import { startAuthentication } from '@simplewebauthn/browser';
import { useI18n } from '@/i18n';
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

type Step = 'phone' | 'pin' | 'otp' | 'no-account' | 'auto';

interface AuthResponse {
  user: { id: string; role: string };
  tokens: AuthSessionTokens;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const rememberedPhone = useAuthStore((s) => s.lastPhone);
  const setLastPhone = useAuthStore((s) => s.setLastPhone);

  const { t } = useI18n();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState<string>(rememberedPhone ?? '+251');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const next = params.get('next') ?? '/';
  const oauthError = params.get('oauthError');

  const startOAuth = (provider: 'google' | 'github') => {
    const query = new URLSearchParams({ next });
    window.location.assign(`${API_URL}/v1/auth/oauth/${provider}/start?${query.toString()}`);
  };

  const finishLogin = (result: AuthResponse, phoneJustUsed: string) => {
    setSession(result.tokens, phoneJustUsed);
    toast.success(t('loginSmart.welcomeBack'));
    router.push(next);
  };

  // Already signed in (e.g. back-navigation landed on /login)? Redirect
  // silently — never re-run the trusted-device flow, which toasts
  // 'Welcome back' and made back buttons feel broken.
  useEffect(() => {
    if (accessToken) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // On mount: if this device is trusted (deviceToken present) AND we remember
  // the phone, try the invisible fast path immediately — no user interaction.
  useEffect(() => {
    const deviceToken = getDeviceToken();
    if (deviceToken && rememberedPhone && ETHIOPIAN_PHONE_REGEX.test(rememberedPhone)) {
      setStep('auto');
      apiFetch<AuthResponse>('/auth/login/trusted-device', {
        method: 'POST',
        body: { phone: rememberedPhone, deviceToken },
      })
        .then((result) => finishLogin(result, rememberedPhone))
        .catch(() => {
          // Silent failure → drop to phone step. Device is likely expired.
          setStep('phone');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!oauthError) return;
    toast.error(
      oauthError === 'provider_unavailable'
        ? 'This sign-in provider is not configured yet.'
        : 'OAuth sign-in could not be completed.',
    );
  }, [oauthError]);

  // ---------------------------------------
  // Step: phone — decide the best next step
  // ---------------------------------------
  const submitPhone = async (isResend = false) => {
    if (!ETHIOPIAN_PHONE_REGEX.test(phone)) {
      toast.error(t('auth.invalidPhone'));
      return;
    }
    setLastPhone(phone);
    if (isResend) setResending(true);
    else setLoading(true);
    try {
      const deviceToken = getDeviceToken() ?? undefined;
      const result = await apiFetch<{
        sent: boolean;
        deviceTrusted?: boolean;
        hasPin?: boolean;
      }>('/auth/otp/request', {
        method: 'POST',
        body: { phone, purpose: 'LOGIN', deviceToken },
      });

      if (result.deviceTrusted) {
        // Device is trusted server-side. Prefer PIN if set, else use silent device login.
        if (result.hasPin) setStep('pin');
        else await trustedDeviceLogin();
        return;
      }

      // Full OTP needed
      if (!isResend) setStep('otp');
      toast.success(isResend ? t('auth.codeResent') : t('auth.codeSent'));
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'ACCOUNT_NOT_FOUND') setStep('no-account');
      else toast.error(e.message ?? t('auth.invalidPhone'));
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const trustedDeviceLogin = async () => {
    const deviceToken = getDeviceToken();
    if (!deviceToken) return submitPhone();
    setLoading(true);
    try {
      const result = await apiFetch<AuthResponse>('/auth/login/trusted-device', {
        method: 'POST',
        body: { phone, deviceToken },
      });
      finishLogin(result, phone);
    } catch {
      toast.error(dt('Trusted device expired. Please verify with a code.'));
      setStep('otp');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------
  // Step: pin — 6-digit shortcut
  // ---------------------------------------
  const submitPin = async (submittedPin?: string) => {
    const p = submittedPin ?? pin;
    if (p.length !== 6) return;
    const deviceToken = getDeviceToken();
    if (!deviceToken) {
      // Shouldn't happen — pin flow only entered when device is trusted.
      setStep('otp');
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<AuthResponse>('/auth/login/pin', {
        method: 'POST',
        body: { phone, pin: p, deviceToken },
      });
      finishLogin(result, phone);
    } catch (err) {
      const e = err as ApiError;
      setPin('');
      if (e.code === 'RATE_LIMITED') {
        toast.error(dt('Too many attempts. Try the code instead.'));
        setStep('otp');
        await submitPhone();
      } else {
        toast.error(e.message ?? 'Incorrect PIN');
      }
    } finally {
      setLoading(false);
    }
  };

  const tryPasskey = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        toast.error(dt('Face ID / Fingerprint requires a secure (https) connection.'));
        return;
      }
      const options = await apiFetch<unknown>('/auth/passkey/login-options', {
        method: 'POST',
        body: { phone },
      });
      const assertion = await startAuthentication({
        optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });
      const result = await apiFetch<AuthResponse>('/auth/passkey/login', {
        method: 'POST',
        body: { phone, response: assertion },
      });
      finishLogin(result, phone);
    } catch (err) {
      // User cancelling the biometric prompt is not an error.
      const e = err as { name?: string; message?: string };
      if (e.name !== 'NotAllowedError') {
        toast.error(e.message ?? 'Biometric sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------
  // Step: otp — full verification
  // ---------------------------------------
  const submittingRef = useRef(false);
  const handleLoginError = (err: unknown) => {
    const e = err as ApiError;
    // A suspended account (isActive=false) currently returns a bare "Account
    // inactive" 401. Surface it as a clear, actionable message so the user isn't
    // met with a dead-end, and point them to support/help.
    if (e?.status === 401 && /inactive|suspend/i.test(e.message ?? '')) {
      toast.error('This account is suspended. Contact support to have it restored.', {
        duration: 6000,
      });
      return;
    }
    toast.error(e?.message ?? 'Login failed');
  };
  const verifyAndLogin = async (submittedCode?: string) => {
    const c = submittedCode ?? code;
    // Guard against duplicate submission: pasting/typing the last digit fires
    // onChange, Enter, and the button — a second call would find the OTP
    // already consumed and show a spurious "expired".
    if (c.length !== OTP_LENGTH || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const { verifiedToken } = await apiFetch<{ verifiedToken: string }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code: c },
      });
      const result = await apiFetch<AuthResponse>('/auth/login/otp', {
        method: 'POST',
        body: { otpToken: verifiedToken },
      });
      finishLogin(result, phone);
    } catch (err) {
      setCode('');
      handleLoginError(err);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="mesh-bg flex min-h-dvh flex-col">
      <header className="safe-top flex items-center gap-3 p-5">
        <Link
          href="/"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium text-muted-foreground">{t('common.back')}</span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-10">
        <div className="mb-6">
          <BrandMark size={48} />
        </div>

        <AnimatePresence mode="wait">
          {step === 'auto' && (
            <StepBox key="auto">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t('loginSmart.signingIn')}</span>
              </div>
            </StepBox>
          )}

          {step === 'phone' && (
            <StepBox key="phone">
              <h1 className="text-3xl font-extrabold tracking-tight">
                {t('loginSmart.welcomeBack')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('loginSmart.smartSubtitle')}</p>

              <label className="mt-8 block text-xs font-semibold text-muted-foreground">
                {t('auth.phoneLabel')}
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.phonePlaceholder')}
                className="mt-2 h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg font-medium tracking-wider outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />

              <Button
                variant="brand"
                size="lg"
                className="mt-6 w-full"
                onClick={() => submitPhone()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {t('common.continue')} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={tryPasskey}
                className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <Fingerprint className="h-4 w-4" />
                {t('loginSmart.useBiometrics')}
              </button>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startOAuth('google')}
                  className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  <GoogleIcon className="h-4 w-4" /> Google
                </button>
                <button
                  type="button"
                  onClick={() => startOAuth('github')}
                  className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  <GithubIcon className="h-4 w-4" /> GitHub
                </button>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t('auth.newHere')}{' '}
                <Link href="/signup" className="font-semibold text-primary">
                  {t('auth.createAccount')}
                </Link>
              </p>
            </StepBox>
          )}

          {step === 'pin' && (
            <StepBox key="pin">
              <LockKeyhole className="mb-4 h-8 w-8 text-primary" />
              <h1 className="text-3xl font-extrabold tracking-tight">
                {t('loginSmart.welcomeBack')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('loginSmart.signedInAs', { phone })}
              </p>

              <div className="mt-8">
                <PinInput
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                    if (v.length === 6) void submitPin(v);
                  }}
                  autoFocus
                  disabled={loading}
                  onSubmit={() => submitPin()}
                />
              </div>

              {loading && (
                <div className="mt-3 flex justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={tryPasskey}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-sm font-semibold"
                >
                  <Fingerprint className="h-4 w-4" />
                  {t('loginSmart.useBiometrics')}
                </button>
                <button
                  type="button"
                  onClick={() => submitPhone()}
                  className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('loginSmart.sendCodeInstead')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="mt-2 text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('loginSmart.useDifferentPhone')}
                </button>
              </div>
            </StepBox>
          )}

          {step === 'no-account' && (
            <StepBox key="no-account">
              <div className="grad-hero mb-6 grid h-14 w-14 place-items-center rounded-2xl text-white">
                <UserPlus className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.noAccount')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('auth.noAccountBody', { phone })}
              </p>

              <Button asChild variant="brand" size="lg" className="mt-8 w-full">
                <Link href={`/signup?phone=${encodeURIComponent(phone)}`}>
                  {t('auth.createAccount')} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <button
                onClick={() => setStep('phone')}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                {t('auth.useDifferentNumber')}
              </button>
            </StepBox>
          )}

          {step === 'otp' && (
            <StepBox key="otp">
              <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.enterCode')}</h1>
              <OtpInput
                phone={phone}
                code={code}
                onChange={(c) => {
                  setCode(c);
                  if (c.length === OTP_LENGTH) void verifyAndLogin(c);
                }}
                onResend={() => submitPhone(true)}
                resending={resending}
                onSubmit={() => verifyAndLogin()}
              />
              <Button
                variant="brand"
                size="lg"
                className="mt-6 w-full"
                onClick={() => verifyAndLogin()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.verifyAndSignIn')}
              </Button>
              <button
                onClick={() => setStep('phone')}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                {t('auth.useDifferentNumber')}
              </button>
            </StepBox>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StepBox({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
