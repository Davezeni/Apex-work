'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/auth/otp-input';
import { apiFetch, ApiError } from '@/lib/api';
import { ETHIOPIAN_PHONE_REGEX, OTP_LENGTH } from '@apex-work/shared';
import { useAuthStore } from '@/stores/auth-store';

type Step = 'phone' | 'otp' | 'no-account';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+251');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const sendOtp = async (isResend = false) => {
    if (!ETHIOPIAN_PHONE_REGEX.test(phone)) {
      toast.error('Enter a valid Ethiopian mobile number');
      return;
    }
    if (isResend) setResending(true);
    else setLoading(true);
    try {
      await apiFetch('/auth/otp/request', { method: 'POST', body: { phone, purpose: 'LOGIN' } });
      if (!isResend) setStep('otp');
      toast.success(isResend ? 'New code sent' : 'Code sent to your phone');
    } catch (err) {
      const e = err as ApiError;
      // Special case: phone not registered → show sign-up CTA instead of raw error toast
      if (e.code === 'ACCOUNT_NOT_FOUND') {
        setStep('no-account');
      } else {
        toast.error(e.message ?? 'Failed to send code');
      }
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const verifyAndLogin = async (submittedCode?: string) => {
    const c = submittedCode ?? code;
    if (c.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setLoading(true);
    try {
      const { verifiedToken } = await apiFetch<{ verifiedToken: string; userId: string | null }>(
        '/auth/otp/verify',
        { method: 'POST', body: { phone, code: c } },
      );
      const result = await apiFetch<{
        user: { id: string; role: string };
        tokens: { accessToken: string; refreshToken: string; expiresIn: number };
      }>('/auth/login/otp', { method: 'POST', body: { otpToken: verifiedToken } });
      setSession(result.tokens);
      toast.success('Welcome back!');
      router.push('/');
    } catch (err) {
      const e = err as ApiError;
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
          {step === 'phone' ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ll send a verification code to your phone.
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
                onClick={() => sendOtp()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Send code <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                New to Apex-Work?{' '}
                <Link href="/signup" className="font-semibold text-primary">
                  Create an account
                </Link>
              </p>
            </motion.div>
          ) : step === 'no-account' ? (
            <motion.div
              key="no-account"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.25 }}
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-3xl font-extrabold tracking-tight">Enter your code</h1>
              <OtpInput
                phone={phone}
                code={code}
                onChange={(c) => {
                  setCode(c);
                  // Auto-submit when the full code is entered — no button press needed
                  if (c.length === OTP_LENGTH) void verifyAndLogin(c);
                }}
                onResend={() => sendOtp(true)}
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
