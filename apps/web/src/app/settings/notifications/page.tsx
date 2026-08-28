'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Package, Star, Wallet, Bell, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { usePush } from '@/hooks/use-push';
import { useMe } from '@/hooks/use-me';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notification-preferences';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@apex-work/shared';

type PrefKey = keyof NotificationPreferences;

const KEYS: { key: PrefKey; icon: React.ReactNode; label: string; sub: string }[] = [
  { key: 'messages', icon: <MessageCircle className="h-4 w-4" />, label: 'New messages', sub: 'When someone messages you' },
  { key: 'orders', icon: <Package className="h-4 w-4" />, label: 'Order updates', sub: 'Status changes, deliveries, revisions' },
  { key: 'reviews', icon: <Star className="h-4 w-4" />, label: 'Reviews', sub: 'When you receive a new review' },
  { key: 'payments', icon: <Wallet className="h-4 w-4" />, label: 'Payments & payouts', sub: 'Withdrawals, escrow releases' },
  { key: 'promotions', icon: <Sparkles className="h-4 w-4" />, label: 'Promotions', sub: 'New features, offers, tips' },
  { key: 'system', icon: <Bell className="h-4 w-4" />, label: 'System alerts', sub: 'Security & account activity' },
];

export default function NotifSettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const push = usePush();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/settings/notifications');
  }, [meLoading, isAuthed, router]);

  useEffect(() => {
    if (preferences.data) setPrefs(preferences.data);
  }, [preferences.data]);

  const toggle = (key: PrefKey, value: boolean) => {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    update.mutate(next, {
      onError: (error) => {
        setPrefs(previous);
        toast.error(error.message || 'Could not save notification preference');
      },
    });
  };

  if (meLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          <h1 className="text-lg font-extrabold tracking-tight">{t('settings.notifications')}</h1>
          <p className="text-[11px] text-muted-foreground">Synced across your devices</p>
        </div>
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
          {push.state === 'unsupported' ? (
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">N/A</span>
          ) : push.subscribed ? (
            <Button size="sm" variant="outline" onClick={push.disable} disabled={push.busy}>
              {push.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Disable'}
            </Button>
          ) : (
            <Button size="sm" variant="brand" onClick={push.enable} disabled={push.busy}>
              {push.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enable'}
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
            <Switch checked={prefs[row.key]} onChange={(value) => toggle(row.key, value)} />
          </label>
        ))}
      </div>
      {preferences.isLoading && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Loading account preferences…</p>
      )}
      {update.isPending && (
        <p className="mt-3 text-center text-[11px] text-primary">Saving preference…</p>
      )}
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
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
