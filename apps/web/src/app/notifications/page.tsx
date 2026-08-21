'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { Bell, Loader2, Check } from 'lucide-react';
import { useNotifications, useMarkAllRead, type AppNotification } from '@/hooks/use-notifications';
import { useMe } from '@/hooks/use-me';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

const ICON: Record<string, string> = {
  ORDER_UPDATE: '📦',
  NEW_MESSAGE: '💬',
  NEW_BID: '📢',
  PAYMENT: '💰',
  SYSTEM: '⚙️',
  REVIEW: '⭐',
};

export default function NotificationsPage() {
  const { isAuthed } = useMe();
  const { data, isLoading } = useNotifications();
  const markAll = useMarkAllRead();
  const { t } = useI18n();

  const items = data?.items ?? [];
  const hasUnread = items.some((n) => !n.readAt);

  // Best-effort: mark all as read when the user opens the page
  useEffect(() => {
    if (hasUnread) markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  if (!isAuthed) {
    return (
      <MobileShell activeTab="profile">
        <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
          <Bell className="h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-extrabold">{t('notifications.signInPrompt')}</h1>
          <Button asChild variant="brand" size="lg" className="mt-6">
            <Link href="/login">{t('nav.signIn')}</Link>
          </Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell activeTab="profile">
      <header className="safe-top flex items-center justify-between px-5 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('notifications.title')}</h1>
        {hasUnread && (
          <button
            onClick={() => markAll.mutate()}
            className="flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Check className="h-3.5 w-3.5" /> {t('notifications.markAllRead')}
          </button>
        )}
      </header>

      {isLoading && (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="mx-5 mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">{t('notifications.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('notifications.emptyBody')}</p>
        </div>
      )}

      <div className="flex flex-col gap-1 px-2 pb-8">
        {items.map((n) => (
          <NotificationRow key={n.id} n={n} />
        ))}
      </div>
    </MobileShell>
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  // Route based on payload contents (fallback: no navigation)
  const payload = n.payload ?? {};
  let href: string | undefined;
  if (typeof payload.orderId === 'string') href = `/orders/${payload.orderId}`;
  else if (typeof payload.conversationId === 'string')
    href = `/messages/${payload.conversationId}`;

  const inner = (
    <div className="flex items-start gap-3 rounded-2xl p-3 active:bg-card">
      <div
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl',
          n.readAt ? 'bg-muted text-muted-foreground' : 'grad-hero text-white',
        )}
      >
        {ICON[n.type] ?? '🔔'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm leading-tight',
              !n.readAt && 'font-bold',
            )}
          >
            {n.title}
          </p>
          {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>
        )}
        <div className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}
