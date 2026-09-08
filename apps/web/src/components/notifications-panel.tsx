'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ExternalLink, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  ICON_EMOJI,
  type AppNotification,
} from '@/hooks/use-notifications';
import { useI18n } from '@/i18n';
import { cn, timeAgo } from '@/lib/utils';

function hrefFor(n: AppNotification): string | undefined {
  const p = n.payload ?? {};
  if (typeof p.orderId === 'string') return `/orders/${p.orderId}`;
  if (typeof p.conversationId === 'string') return `/messages/${p.conversationId}`;
  return undefined;
}

function Row({ n }: { n: AppNotification }) {
  const href = hrefFor(n);
  const inner = (
    <div className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted">
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg',
          n.readAt ? 'bg-muted text-muted-foreground' : 'grad-hero text-white',
        )}
      >
        {ICON_EMOJI[n.type] ?? '🔔'}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-tight', !n.readAt && 'font-bold')}>{n.title}</p>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>
        )}
        <div className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</div>
      </div>
      {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

/**
 * Desktop notification bell + dropdown. Replaces the plain bell link on
 * desktop: clicking shows the latest notifications inline with a "mark all
 * read" action and a link to the full page. Hides itself when signed out.
 */
export function NotificationsPanel({ className }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: countData } = useUnreadCount();
  const unread = countData?.count ?? 0;
  const { data } = useNotifications();
  const markAllRead = useMarkAllRead();
  const items = data?.items ?? [];

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const doMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success('Marked all as read'),
      onError: () => toast.error('Could not mark all as read'),
    });
  };

  return (
    <div ref={ref} className={cn('relative', className ?? '')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-[18px] items-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-bold">{t('nav.notifications')}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={doMarkAll}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('notifications.empty')}
              </div>
            ) : (
              items.slice(0, 12).map((n) => <Row key={n.id} n={n} />)
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 border-t border-border px-4 py-2.5 text-xs font-semibold text-primary"
          >
            View all <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
