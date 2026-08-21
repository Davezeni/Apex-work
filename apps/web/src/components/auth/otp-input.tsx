'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { OTP_LENGTH } from '@apex-work/shared';

const RESEND_COOLDOWN_SEC = 60;

interface Props {
  phone: string;
  code: string;
  onChange: (code: string) => void;
  onResend: () => void | Promise<void>;
  resending?: boolean;
}

/**
 * OTP input with:
 * - large centered digits + auto-focus
 * - a 60s resend cooldown timer that starts when the component mounts,
 *   and resets whenever `onResend` completes
 */
export function OtpInput({ phone, code, onChange, onResend, resending }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const canResend = secondsLeft <= 0 && !resending;

  const handleResend = async () => {
    if (!canResend) return;
    await onResend();
    setSecondsLeft(RESEND_COOLDOWN_SEC);
  };

  return (
    <div>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a {OTP_LENGTH}-digit code to{' '}
        <span className="font-semibold text-foreground">{phone}</span>
      </p>

      <input
        autoFocus
        type="text"
        inputMode="numeric"
        pattern="\d*"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        value={code}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="●●●●●●"
        className="mt-8 h-16 w-full rounded-2xl border border-border bg-card text-center text-3xl font-extrabold tracking-[0.5em] outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
      />

      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            className="font-semibold text-primary hover:underline"
          >
            Resend code
          </button>
        ) : resending ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sending…
          </span>
        ) : (
          <span className="text-muted-foreground">
            Resend code in{' '}
            <span className="font-semibold text-foreground">{secondsLeft}s</span>
          </span>
        )}
      </div>
    </div>
  );
}
