'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
interface Props {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  /** true = mask digits like a normal password field */
  masked?: boolean;
  /** Called when the user completes/presses Enter on the PIN. */
  onSubmit?: () => void;
}

/**
 * 6-box PIN input. Uses a single hidden input for actual state + accessibility
 * + iOS SMS/PIN auto-fill (autoComplete="one-time-code"), and renders the
 * digits as pretty circles on top. This is much simpler and more reliable
 * than one-input-per-digit implementations (which break on paste, keyboard
 * languages, and auto-fill).
 */
export function PinInput({ value, onChange, autoFocus, disabled, masked = true, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const focus = () => inputRef.current?.focus();

  return (
    <div
      className="relative mx-auto flex w-fit gap-2"
      onClick={focus}
      onKeyDown={(e) => {
        // Space/Enter delegate focus to the invisible input for keyboard-only users.
        if (e.key === 'Enter' || e.key === ' ') focus();
      }}
      role="group"
      aria-label={dt('6-digit PIN')}
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <div
            key={i}
            className={cn(
              'grid h-14 w-11 place-items-center rounded-2xl border-2 text-2xl font-extrabold transition-all sm:h-16 sm:w-12',
              filled ? 'border-primary bg-primary/5' : 'border-border bg-card',
              active && !disabled && 'ring-4 ring-primary/20',
              disabled && 'opacity-60',
            )}
          >
            {filled ? (masked ? '•' : value[i]) : ''}
          </div>
        );
      })}

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit && value.length === 6) {
            e.preventDefault();
            onSubmit();
          }
        }}
        // Visually hidden but accessible + iOS keyboard-friendly
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={dt('Enter 6-digit PIN')}
      />
    </div>
  );
}
