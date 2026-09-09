'use client';

import { dt } from '@/i18n/auto';
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
  /** Called when the user presses Enter / the keyboard "done" key. */
  onSubmit?: () => void;
}

/**
 * OTP input with:
 * - large centered digits + auto-focus
 * - a 60s resend cooldown timer that starts when the component mounts,
 *   and resets whenever `onResend` completes
 */
export function OtpInput({ phone, code, onChange, onResend, resending, onSubmit }: Props) {
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
        name="otp"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        maxLength={OTP_LENGTH}
        value={code}
        onChange={(e) => {
          // Accept only digits, clamp to OTP_LENGTH (handles pasted SMS codes).
          const digits = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
          onChange(digits);
        }}
        onKeyDown={(e) => {
          // Submit on Enter / keyboard "done": desktop Enter and mobile
          // keyboards both fire this, so completing the code logs in.
          if (e.key === 'Enter' && onSubmit && code.length === OTP_LENGTH) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={dt('••••••')}
        className="mt-8 h-16 w-full rounded-2xl border border-border bg-card text-center text-3xl font-extrabold tracking-[0.5em] outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
        aria-label={`${OTP_LENGTH}-digit verification code`}
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
            Resend code in <span className="font-semibold text-foreground">{secondsLeft}s</span>
          </span>
        )}
      </div>
    </div>
  );
}
