'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/hooks/use-notifications';

/**
 * The bell icon that lives in the top-right of the mobile home.
 * Shows a red dot with the unread count. Links to /notifications.
 * Silently no-ops when the user isn't signed in.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
      className={`relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card active:scale-95 ${
        className ?? ''
      }`}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 grid min-w-[18px] items-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
