'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Wallet as WalletIcon,
  Send,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useWallet,
  useWithdrawals,
  useCancelWithdrawal,
  type WalletData,
} from '@/hooks/use-wallet';
import { LazyWithdrawSheet as WithdrawSheet } from '@/components/lazy';
import { useI18n } from '@/i18n';
import { cn, formatEtb, timeAgo } from '@/lib/utils';

type TxType = WalletData['transactions'][number]['type'];

const TX_META: Record<TxType, { icon: string; positive: boolean }> = {
  ORDER_PAYMENT: { icon: '💳', positive: false },
  ORDER_PAYOUT: { icon: '💰', positive: true },
  ORDER_REFUND: { icon: '↩️', positive: true },
  WITHDRAWAL: { icon: '🏦', positive: false },
  PLATFORM_FEE: { icon: '🧾', positive: false },
  REFERRAL_BONUS: { icon: '🎁', positive: true },
};

export default function WalletPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data, isLoading } = useWallet();
  const { data: wdData } = useWithdrawals();
  const cancel = useCancelWithdrawal();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/wallet');
  }, [meLoading, isAuthed, router]);

  if (isLoading || !data || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const w = data.wallet;
  const txs = data.transactions ?? [];
  const withdrawals = wdData?.items ?? [];

  return (
    <div className="min-h-dvh bg-background pb-16">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('wallet.title')}</h1>
      </header>

      {/* Balance card */}
      <section className="mx-4 mt-4">
        <div className="grad-hero relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl shadow-primary/50">
          <div className="absolute right-4 top-4 opacity-30">
            <WalletIcon className="h-16 w-16" />
          </div>
          <div className="text-xs font-medium uppercase tracking-widest opacity-80">
            {t('wallet.balance')}
          </div>
          <div className="mt-1 text-4xl font-extrabold tracking-tight">
            {formatEtb(w.balanceEtb)}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div>
              <div className="opacity-70">{t('wallet.pending')}</div>
              <div className="mt-0.5 font-bold">{formatEtb(w.pendingEtb)}</div>
            </div>
            <div>
              <div className="opacity-70">{t('wallet.lifetime')}</div>
              <div className="mt-0.5 font-bold">{formatEtb(w.lifetimeEarnedEtb)}</div>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setSheetOpen(true)}
              disabled={w.balanceEtb < 1}
              className="grad-hero flex-1 rounded-xl bg-white/25 py-3 text-sm font-bold backdrop-blur transition-transform active:scale-95 disabled:opacity-40"
            >
              <span className="inline-flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4" /> {t('wallet.withdraw')}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Recent withdrawals */}
      {withdrawals.length > 0 && (
        <section className="mx-4 mt-6">
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">{t('wallet.recent')}</h2>
          <div className="space-y-2">
            {withdrawals.slice(0, 5).map((wd) => (
              <div
                key={wd.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-lg">
                  🏦
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {formatEtb(wd.amountEtb)}
                    </div>
                    <StatusPill status={wd.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {wd.destination} · {timeAgo(wd.createdAt)}
                  </div>
                </div>
                {wd.status === 'PENDING' && (
                  <button
                    onClick={() => {
                      if (!window.confirm(t('common.cancel') + '?')) return;
                      cancel.mutate(wd.id, {
                        onSuccess: () => toast.success(t('wallet.status.CANCELLED')),
                      });
                    }}
                    aria-label={t('wallet.cancel')}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transactions */}
      <section className="mx-4 mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
          <History className="h-4 w-4" /> {t('wallet.history')}
        </h2>
        {txs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="text-3xl">💸</div>
            <p className="mt-3 text-sm font-semibold">{t('wallet.empty')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('wallet.emptyBody')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {txs.map((tx) => {
              const meta = TX_META[tx.type];
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-lg">
                    {meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {t(`wallet.tx.${tx.type}`)}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {tx.description || timeAgo(tx.createdAt)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'text-sm font-extrabold tabular-nums',
                      tx.amountEtb >= 0 ? 'text-emerald-500' : 'text-foreground',
                    )}
                  >
                    {tx.amountEtb >= 0 ? '+' : ''}
                    {formatEtb(tx.amountEtb)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <WithdrawSheet open={sheetOpen} onOpenChange={setSheetOpen} maxAmount={w.balanceEtb} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const color =
    status === 'SUCCESS'
      ? 'bg-emerald-500/10 text-emerald-600'
      : status === 'FAILED'
        ? 'bg-red-500/10 text-red-600'
        : status === 'CANCELLED'
          ? 'bg-muted text-muted-foreground'
          : 'bg-amber-500/10 text-amber-600';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', color)}>
      {t(`wallet.status.${status}`)}
    </span>
  );
}
