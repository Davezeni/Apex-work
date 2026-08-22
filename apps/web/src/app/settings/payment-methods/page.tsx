'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CreditCard, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { PAYMENT_METHODS } from '@apex-work/shared';
import { cn } from '@/lib/utils';

interface SavedMethod {
  id: string;
  type: string;
  label: string;
  masked: string;
  isDefault: boolean;
}

const STORAGE = 'apex-payment-methods-v1';

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [methods, setMethods] = useState<SavedMethod[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE) ?? '[]');
    } catch { return []; }
  });
  const [adding, setAdding] = useState(false);
  const [chosenType, setChosenType] = useState<string>('telebirr');
  const [account, setAccount] = useState('');

  const persist = (list: SavedMethod[]) => {
    setMethods(list);
    localStorage.setItem(STORAGE, JSON.stringify(list));
  };

  const add = () => {
    if (account.trim().length < 4) return toast.error('Enter a valid account');
    const method = PAYMENT_METHODS.find((m) => m.id === chosenType);
    const masked = account.length > 4 ? `••••${account.slice(-4)}` : account;
    const next: SavedMethod = {
      id: `${chosenType}-${Date.now()}`,
      type: chosenType,
      label: method?.label ?? chosenType,
      masked,
      isDefault: methods.length === 0,
    };
    persist([...methods, next]);
    setAdding(false);
    setAccount('');
    toast.success('Payment method added');
  };

  const remove = (id: string) => {
    if (!window.confirm('Remove this payment method?')) return;
    persist(methods.filter((m) => m.id !== id));
  };

  const setDefault = (id: string) => {
    persist(methods.map((m) => ({ ...m, isDefault: m.id === id })));
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Payment methods</h1>
      </header>

      <div className="mx-3 mt-4 space-y-2">
        {methods.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">No saved methods</p>
            <p className="mt-1 text-xs text-muted-foreground">Add Telebirr, CBE Birr, or a card to check out faster.</p>
          </div>
        )}
        {methods.map((m) => {
          const meta = PAYMENT_METHODS.find((x) => x.id === m.type);
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-lg">
                {meta?.icon ?? '💳'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">{m.label}</span>
                  {m.isDefault && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">DEFAULT</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">{m.masked}</div>
              </div>
              {!m.isDefault && (
                <button onClick={() => setDefault(m.id)} className="text-[11px] font-bold text-primary">
                  Make default
                </button>
              )}
              <button onClick={() => remove(m.id)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-full text-red-500 active:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {adding ? (
        <section className="mx-3 mt-5 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Add payment method</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.slice(0, 6).map((m) => (
              <button
                key={m.id}
                onClick={() => setChosenType(m.id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold',
                  chosenType === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background',
                )}
              >
                <span>{m.icon}</span>
                <span className="truncate">{m.label}</span>
              </button>
            ))}
          </div>
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={chosenType === 'telebirr' || chosenType === 'cbebirr' ? '+2519XXXXXXXX' : 'Account / card number'}
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="brand" size="lg" className="flex-1" onClick={add}>
              Save
            </Button>
          </div>
        </section>
      ) : (
        <div className="mx-3 mt-5">
          <Button variant="brand" size="lg" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add payment method
          </Button>
        </div>
      )}
    </div>
  );
}
