'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { PAYMENT_METHODS } from '@apex-work/shared';
import { usePaymentConfig } from '@/hooks/use-payment';
import { cn } from '@/lib/utils';

/**
 * Chapa hosts the actual payment form, so Apex-Work must not collect or
 * persist wallet PINs, CVVs, or full account numbers in localStorage. This
 * page explains the real checkout options and reports live gateway status.
 */
export default function PaymentMethodsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const config = usePaymentConfig();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Payment methods</h1>
          <p className="text-[11px] text-muted-foreground">Secure checkout through Chapa</p>
        </div>
      </header>

      <section className="mx-3 mt-4">
        <div
          className={cn(
            'rounded-2xl border p-4',
            config.data?.enabled
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : config.isLoading
                ? 'border-border bg-card'
                : 'border-amber-500/30 bg-amber-500/5',
          )}
        >
          <div className="flex items-start gap-3">
            {config.isLoading ? (
              <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-muted-foreground" />
            ) : config.data?.enabled ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-500" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold">
                {config.isLoading
                  ? 'Checking payment gateway…'
                  : config.data?.enabled
                    ? 'Chapa checkout is ready'
                    : 'Checkout is temporarily unavailable'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {config.data?.enabled
                  ? 'When you continue an order, Chapa opens a secure checkout where you choose your wallet, bank, or card.'
                  : 'Please try again later. No payment details are collected or stored while checkout is unavailable.'}
              </p>
            </div>
          </div>
          {config.isError && (
            <button onClick={() => void config.refetch()} className="mt-3 text-xs font-bold text-primary">
              Check again
            </button>
          )}
        </div>
      </section>

      <section className="mx-3 mt-6">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Available at secure checkout
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {PAYMENT_METHODS.map((method) => (
            <div key={method.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-lg">
                {method.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{method.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  Choose this option on the Chapa payment screen
                </div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-3 mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-bold">How your payment is protected</h2>
            <ol className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li><b className="text-foreground">1.</b> Apex-Work creates a unique order reference.</li>
              <li><b className="text-foreground">2.</b> Chapa hosts the wallet, bank, or card payment form.</li>
              <li><b className="text-foreground">3.</b> Apex-Work verifies the transaction server-side before activating the order.</li>
              <li><b className="text-foreground">4.</b> Funds stay in escrow until delivery is accepted or a dispute is resolved.</li>
            </ol>
          </div>
        </div>
      </section>

      <div className="mx-3 mt-5">
        <Button asChild variant="brand" size="lg" className="w-full" disabled={config.data?.enabled === false}>
          <Link href="/browse">
            Browse services <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
