'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Package, Star, Wallet, Bell, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

/**
 * Notification preferences. Persisted in localStorage until we ship a
 * /me/notification-prefs backend endpoint — the client is the source of
 * truth today for a good reason: we only push web notifications on this
 * device, so per-device toggles feel natural.
 */
type PrefKey =
  | 'messages'
  | 'orders'
  | 'reviews'
  | 'payments'
  | 'promotions'
  | 'system';

const KEYS: { key: PrefKey; icon: React.ReactNode; label: string; sub: string }[] = [
  { key: 'messages', icon: <MessageCircle className="h-4 w-4" />, label: 'New messages', sub: 'When someone messages you' },
  { key: 'orders', icon: <Package className="h-4 w-4" />, label: 'Order updates', sub: 'Status changes, deliveries, revisions' },
  { key: 'reviews', icon: <Star className="h-4 w-4" />, label: 'Reviews', sub: 'When you receive a new review' },
  { key: 'payments', icon: <Wallet className="h-4 w-4" />, label: 'Payments & payouts', sub: 'Withdrawals, escrow releases' },
  { key: 'promotions', icon: <Sparkles className="h-4 w-4" />, label: 'Promotions', sub: 'New features, offers, tips' },
  { key: 'system', icon: <Bell className="h-4 w-4" />, label: 'System alerts', sub: 'Security & account activity' },
];

const STORAGE_KEY = 'apex-work-notif-prefs-v1';

export default function NotifSettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    messages: true, orders: true, reviews: true,
    payments: true, promotions: false, system: true,
  });
  const [pushGranted, setPushGranted] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...prefs, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    if (typeof Notification !== 'undefined') {
      setPushGranted(Notification.permission === 'granted');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (k: PrefKey, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const enablePush = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Your browser does not support push notifications');
      return;
    }
    const perm = await Notification.requestPermission();
    setPushGranted(perm === 'granted');
    if (perm === 'granted') toast.success('Push notifications enabled');
    else toast.error('Push notifications blocked');
  };

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
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.notifications')}</h1>
      </header>

      {/* Push permission */}
      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="grad-hero grid h-10 w-10 place-items-center rounded-xl text-white">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">Browser push notifications</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Get notified even when Apex-Work is in the background.
            </p>
          </div>
          {pushGranted ? (
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500">
              ON
            </span>
          ) : (
            <Button size="sm" variant="brand" onClick={enablePush}>
              Enable
            </Button>
          )}
        </div>
      </section>

      {/* Per-category toggles */}
      <div className="mx-3 mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
        {KEYS.map((row) => (
          <label
            key={row.key}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-muted"
          >
            <span className="text-muted-foreground">{row.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">{row.label}</div>
              <div className="text-[11px] text-muted-foreground">{row.sub}</div>
            </div>
            <Switch checked={prefs[row.key]} onChange={(v) => toggle(row.key, v)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
