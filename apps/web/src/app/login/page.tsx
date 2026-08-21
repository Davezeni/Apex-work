'use client';

import { Suspense, useEffect, useState } from 'react';
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
import { OtpInput } from '@/components/auth/otp-input';
import { PinInput } from '@/components/auth/pin-input';
import { apiFetch, ApiError } from '@/lib/api';
import { ETHIOPIAN_PHONE_REGEX, OTP_LENGTH } from '@apex-work/shared';
import { useAuthStore, type AuthSessionTokens } from '@/stores/auth-store';
import { getDeviceToken } from '@/lib/device';
import { startAuthentication } from '@simplewebauthn/browser';

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
  const rememberedPhone = useAuthStore((s) => s.lastPhone);
  const setLastPhone = useAuthStore((s) => s.setLastPhone);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState<string>(rememberedPhone ?? '+251');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const next = params.get('next') ?? '/';
  const finishLogin = (result: AuthResponse, phoneJustUsed: string) => {
    setSession(result.tokens, phoneJustUsed);
    toast.success('Welcome back!');
    router.push(next);
  };

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

  // ---------------------------------------
  // Step: phone — decide the best next step
  // ---------------------------------------
  const submitPhone = async (isResend = false) => {
    if (!ETHIOPIAN_PHONE_REGEX.test(phone)) {
      toast.error('Enter a valid Ethiopian mobile number');
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
      toast.success(isResend ? 'New code sent' : 'Code sent to your phone');
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'ACCOUNT_NOT_FOUND') setStep('no-account');
      else toast.error(e.message ?? 'Failed to send code');
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
      toast.error('Trusted device expired. Please verify with a code.');
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
        toast.error('Too many attempts. Try the code instead.');
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
        toast.error('Face ID / Fingerprint requires a secure (https) connection.');
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
  const verifyAndLogin = async (submittedCode?: string) => {
    const c = submittedCode ?? code;
    if (c.length !== OTP_LENGTH) return;
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
      const e = err as ApiError;
      setCode('');
      toast.error(e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mesh-bg flex min-h-dvh flex-col">
      <header className="safe-top flex items-center gap-3 p-5">
        <Link
          href="/"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium text-muted-foreground">Back</span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-10">
        <div className="grad-hero mb-6 grid h-12 w-12 place-items-center rounded-2xl text-xl font-extrabold text-white shadow-lg shadow-primary/40">
          A
        </div>

        <AnimatePresence mode="wait">
          {step === 'auto' && (
            <StepBox key="auto">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Signing you in…</span>
              </div>
            </StepBox>
          )}

          {step === 'phone' && (
            <StepBox key="phone">
              <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ll only send a code the first time you sign in on this device.
              </p>

              <label className="mt-8 block text-xs font-semibold text-muted-foreground">
                Phone number
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9XX XXX XXX"
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
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={tryPasskey}
                className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <Fingerprint className="h-4 w-4" />
                Use Face ID / fingerprint
              </button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                New to Apex-Work?{' '}
                <Link href="/signup" className="font-semibold text-primary">
                  Create an account
                </Link>
              </p>
            </StepBox>
          )}

          {step === 'pin' && (
            <StepBox key="pin">
              <LockKeyhole className="mb-4 h-8 w-8 text-primary" />
              <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Signed in as{' '}
                <span className="font-semibold text-foreground">{phone}</span>
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
                  Use Face ID / fingerprint
                </button>
                <button
                  type="button"
                  onClick={() => submitPhone()}
                  className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  Send me a code instead
                </button>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="mt-2 text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Use a different phone number
                </button>
              </div>
            </StepBox>
          )}

          {step === 'no-account' && (
            <StepBox key="no-account">
              <div className="grad-hero mb-6 grid h-14 w-14 place-items-center rounded-2xl text-white">
                <UserPlus className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">No account yet</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We couldn&apos;t find an account for{' '}
                <span className="font-semibold text-foreground">{phone}</span>. Would you like to
                create one?
              </p>

              <Button asChild variant="brand" size="lg" className="mt-8 w-full">
                <Link href={`/signup?phone=${encodeURIComponent(phone)}`}>
                  Create account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <button
                onClick={() => setStep('phone')}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different phone number
              </button>
            </StepBox>
          )}

          {step === 'otp' && (
            <StepBox key="otp">
              <h1 className="text-3xl font-extrabold tracking-tight">Enter your code</h1>
              <OtpInput
                phone={phone}
                code={code}
                onChange={(c) => {
                  setCode(c);
                  if (c.length === OTP_LENGTH) void verifyAndLogin(c);
                }}
                onResend={() => submitPhone(true)}
                resending={resending}
              />
              <Button
                variant="brand"
                size="lg"
                className="mt-6 w-full"
                onClick={() => verifyAndLogin()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & sign in'}
              </Button>
              <button
                onClick={() => setStep('phone')}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different phone number
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


