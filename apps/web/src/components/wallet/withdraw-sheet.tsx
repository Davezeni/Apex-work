'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useRequestWithdrawal } from '@/hooks/use-wallet';
import { useI18n } from '@/i18n';
import { MIN_WITHDRAWAL_ETB } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';
type Destination =
  'telebirr' | 'cbebirr' | 'cbe_bank' | 'awash_bank' | 'dashen_bank' | 'bank_of_abyssinia';

const DESTINATIONS: { id: Destination; label: string; icon: string; isBank: boolean }[] = [
  { id: 'telebirr', label: 'Telebirr', icon: '📱', isBank: false },
  { id: 'cbebirr', label: 'CBE Birr', icon: '📱', isBank: false },
  { id: 'cbe_bank', label: 'CBE Bank', icon: '🏦', isBank: true },
  { id: 'awash_bank', label: 'Awash Bank', icon: '🏦', isBank: true },
  { id: 'dashen_bank', label: 'Dashen Bank', icon: '🏦', isBank: true },
  { id: 'bank_of_abyssinia', label: 'Bank of Abyssinia', icon: '🏦', isBank: true },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxAmount: number;
}

export function WithdrawSheet({ open, onOpenChange, maxAmount }: Props) {
  const { t } = useI18n();
  const [dest, setDest] = useState<Destination>('telebirr');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const request = useRequestWithdrawal();

  const destMeta = DESTINATIONS.find((d) => d.id === dest)!;
  const parsedAmount = Number(amount || 0);

  const submit = async () => {
    if (parsedAmount < MIN_WITHDRAWAL_ETB) {
      toast.error(t('wallet.amountHint', { min: MIN_WITHDRAWAL_ETB }));
      return;
    }
    if (parsedAmount > maxAmount) {
      toast.error(t('wallet.insufficient'));
      return;
    }
    try {
      await request.mutateAsync({
        amountEtb: Math.floor(parsedAmount),
        destination: dest,
        accountNumber: account.trim(),
        accountName: destMeta.isBank ? name.trim() : undefined,
      });
      toast.success(t('wallet.requested'));
      onOpenChange(false);
      setAmount('');
      setAccount('');
      setName('');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Withdrawal failed');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('wallet.withdrawTitle')}
      description={t('wallet.withdrawSubtitle')}
    >
      <div className="space-y-4">
        {/* Destination */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('wallet.destination')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DESTINATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDest(d.id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition-all active:scale-95',
                  dest === d.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card',
                )}
              >
                <span>{d.icon}</span>
                <span className="truncate">{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('wallet.amount')}
          </label>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={dt('0')}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{t('wallet.amountHint', { min: MIN_WITHDRAWAL_ETB })}</span>
            <button
              type="button"
              onClick={() => setAmount(String(Math.floor(maxAmount)))}
              className="font-semibold text-primary"
            >
              Max: {formatEtb(maxAmount)}
            </button>
          </div>
        </div>

        {/* Account number */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('wallet.accountNumber')}
          </label>
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={destMeta.isBank ? '1000123456789' : '+2519XXXXXXXX'}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>

        {/* Account name (banks only) */}
        {destMeta.isBank && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('wallet.accountName')}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={dt('Dawit Tamiru')}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </div>
        )}

        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={
            request.isPending ||
            parsedAmount < MIN_WITHDRAWAL_ETB ||
            parsedAmount > maxAmount ||
            account.trim().length < 4 ||
            (destMeta.isBank && name.trim().length < 2)
          }
        >
          {request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('wallet.confirm')}
        </Button>
      </div>
    </Sheet>
  );
}
