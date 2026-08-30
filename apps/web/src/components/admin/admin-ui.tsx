'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Small presentational helpers shared by every admin tab. */

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-muted text-muted-foreground',
    ok: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    bad: 'bg-red-500/15 text-red-600 dark:text-red-400',
    info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', tones[tone])}>
      {children}
    </span>
  );
}

export function SectionHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
      <div>
        <h2 className="text-lg font-extrabold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="grid place-items-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}

export function Empty({ message }: { message: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{message}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20';

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{children}</th>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('whitespace-nowrap px-3 py-2 align-middle', className)}>{children}</td>;
}
