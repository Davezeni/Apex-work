'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Briefcase, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { OtpInput } from '@/components/auth/otp-input';
import { ETHIOPIAN_PHONE_REGEX, OTP_LENGTH, type UserRole } from '@apex-work/shared';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

type Step = 'role' | 'phone' | 'otp' | 'name';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const params = useSearchParams();
  // Prefill phone from URL (e.g. redirected from /login when no account exists)
  const phoneFromQuery = params.get('phone');
  const [step, setStep] = useState<Step>(phoneFromQuery ? 'phone' : 'role');
  const [role, setRole] = useState<UserRole>((params.get('role') as UserRole) ?? 'CLIENT');
  const [phone, setPhone] = useState(phoneFromQuery ?? '+251');
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const { t } = useI18n();

  const chooseRole = () => setStep('phone');

  const sendOtp = async (isResend = false) => {
    if (!ETHIOPIAN_PHONE_REGEX.test(phone)) {
      toast.error(t('auth.invalidPhone'));
      return;
    }
    if (isResend) setResending(true);
    else setLoading(true);
    try {
      await apiFetch('/auth/otp/request', { method: 'POST', body: { phone, purpose: 'SIGNUP' } });
      if (!isResend) setStep('otp');
      toast.success(isResend ? t('auth.codeResent') : t('auth.codeSent'));
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Failed to send code');
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const verifyOtp = async (submittedCode?: string) => {
    const c = submittedCode ?? code;
    if (c.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setLoading(true);
    try {
      const { verifiedToken } = await apiFetch<{ verifiedToken: string }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code: c },
      });
      setOtpToken(verifiedToken);
      setStep('name');
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const complete = async () => {
    if (fullName.trim().length < 2) {
      toast.error(t('auth.yourNameDesc'));
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<{
        user: { id: string };
        tokens: { accessToken: string; refreshToken: string; expiresIn: number };
      }>('/auth/signup', {
        method: 'POST',
        body: { phone, otpToken, fullName: fullName.trim(), role },
      });
      setSession(result.tokens, phone);
      toast.success(t('auth.welcomeUser', { name: fullName.split(' ')[0] ?? '' }));
      // Offer to set a PIN so the next login skips the SMS step. It routes
      // onward to onboarding (freelancer) or home (client) via ?next=.
      const next = role === 'FREELANCER' ? '/onboarding' : '/';
      router.push(`/settings/pin?next=${encodeURIComponent(next)}`);
    } catch (err) {
      toast.error((err as ApiError).message ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = ['role', 'phone', 'otp', 'name'].indexOf(step);

  return (
    <div className="mesh-bg flex min-h-dvh flex-col">
      <header className="safe-top flex items-center gap-3 p-5">
        <Link
          href="/"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= stepIndex ? 'bg-primary' : 'bg-border',
              )}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-10">
        <AnimatePresence mode="wait">
          {step === 'role' && (
            <StepBox key="role">
              <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.join')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('create.subtitle')}</p>

              <div className="mt-6 flex flex-col gap-3">
                <RoleCard
                  active={role === 'CLIENT'}
                  onClick={() => setRole('CLIENT')}
                  icon={<Briefcase className="h-6 w-6" />}
                  title={t('roles.clientAction')}
                  subtitle={t('roles.clientDesc')}
                />
                <RoleCard
                  active={role === 'FREELANCER'}
                  onClick={() => setRole('FREELANCER')}
                  icon={<Sparkles className="h-6 w-6" />}
                  title={t('roles.freelancerAction')}
                  subtitle={t('roles.freelancerDesc')}
                />
              </div>

              <Button variant="brand" size="lg" className="mt-8 w-full" onClick={chooseRole}>
                {t('common.continue')} <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t('auth.alreadyRegistered')}{' '}
                <Link href="/login" className="font-semibold text-primary">
                  {t('nav.signIn')}
                </Link>
              </p>
            </StepBox>
          )}

          {step === 'phone' && (
            <StepBox key="phone">
              <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.yourPhone')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('auth.weWillSendCode')}</p>
              <input
                autoFocus
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.phonePlaceholder')}
                className="mt-8 h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
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
                    {t('common.sendCode')} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
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
                  if (c.length === OTP_LENGTH) void verifyOtp(c);
                }}
                onResend={() => sendOtp(true)}
                resending={resending}
              />
              <Button
                variant="brand"
                size="lg"
                className="mt-6 w-full"
                onClick={() => verifyOtp()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.verify')}
              </Button>
            </StepBox>
          )}

          {step === 'name' && (
            <StepBox key="name">
              <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.yourName')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('auth.yourNameDesc')}</p>
              <input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                className="mt-8 h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
              <Button
                variant="brand"
                size="lg"
                className="mt-6 w-full"
                onClick={complete}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.createAccount')}
              </Button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t('auth.termsAgree')}
              </p>
            </StepBox>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StepBox({ children, ...rest }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

function RoleCard({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[.98]',
        active
          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
          : 'border-border bg-card',
      )}
    >
      <div
        className={cn(
          'grid h-12 w-12 place-items-center rounded-xl',
          active ? 'grad-hero text-white' : 'bg-secondary text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}
