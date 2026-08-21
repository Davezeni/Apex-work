'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, LockKeyhole, Loader2, ShieldCheck } from 'lucide-react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { PinInput } from '@/components/auth/pin-input';
import { useSetPin } from '@/hooks/use-security';
import { useMe } from '@/hooks/use-me';

const WEAK_PINS = new Set([
  '000000', '111111', '222222', '333333', '444444', '555555',
  '666666', '777777', '888888', '999999',
  '123456', '654321', '012345', '098765',
  '123123', '456456', '112233', '121212',
]);

/**
 * Two-step PIN setup: enter a PIN, then confirm it. Locally we also block a
 * handful of extremely-common PINs to nudge users away from trivial choices
 * (server also enforces this).
 */
export default function PinSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <PinSetupInner />
    </Suspense>
  );
}

function PinSetupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me, isLoading } = useMe();
  const setPinMutation = useSetPin();

  const [phase, setPhase] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');

  const returnTo = params.get('next') ?? '/profile';

  useEffect(() => {
    if (!isLoading && !me) router.replace('/login?next=/settings/pin');
  }, [isLoading, me, router]);

  const onDigit = (v: string) => {
    setPin(v);
    if (v.length !== 6) return;

    if (phase === 'enter') {
      if (WEAK_PINS.has(v)) {
        toast.error('That PIN is too common. Try something less predictable.');
        setPin('');
        return;
      }
      setFirstPin(v);
      setPin('');
      setPhase('confirm');
    } else {
      if (v !== firstPin) {
        toast.error("PINs don't match. Start over.");
        setPin('');
        setFirstPin('');
        setPhase('enter');
        return;
      }
      void submit(v);
    }
  };

  const submit = async (finalPin: string) => {
    try {
      await setPinMutation.mutateAsync(finalPin);
      toast.success('PIN saved. Next time, sign in with just your PIN.');
      router.push(returnTo);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Could not save PIN');
      setPin('');
      setFirstPin('');
      setPhase('enter');
    }
  };

  return (
    <div className="mesh-bg flex min-h-dvh flex-col">
      <header className="safe-top flex items-center gap-3 p-5">
        <button
          onClick={() => router.back()}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link
          href={returnTo}
          className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-10">
        <div className="grad-hero mb-6 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/40">
          <LockKeyhole className="h-7 w-7" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            <h1 className="text-3xl font-extrabold tracking-tight">
              {phase === 'enter' ? 'Create a 6-digit PIN' : 'Confirm your PIN'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {phase === 'enter'
                ? 'Skip the SMS code every time. Use your PIN to sign in on this device.'
                : 'Enter the same 6 digits again.'}
            </p>

            <div className="mt-8">
              <PinInput
                value={pin}
                onChange={onDigit}
                autoFocus
                disabled={setPinMutation.isPending}
              />
            </div>

            {setPinMutation.isPending && (
              <div className="mt-3 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="mt-6 flex items-start gap-2 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                Your PIN is scrambled before storage and paired with this device.
                It never leaves Apex-Work and can&apos;t be used from another browser.
              </div>
            </div>

            {phase === 'confirm' && (
              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => {
                  setFirstPin('');
                  setPin('');
                  setPhase('enter');
                }}
              >
                Start over
              </Button>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
