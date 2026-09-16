'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useBlockedUsers, useUnblockUser } from '@/hooks/use-moderation';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';

export default function BlocksPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { isLoading: meLoading, isAuthed } = useMe();
  const { data, isLoading } = useBlockedUsers();
  const unblock = useUnblockUser();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/settings/blocks');
  }, [meLoading, isAuthed, router]);

  const items = data?.items ?? [];

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('block.listTitle')}</h1>
      </header>

      {isLoading && (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">{t('block.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('block.emptyBody')}</p>
        </div>
      )}

      <div className="mx-3 mt-3 space-y-2">
        {items.map((row) => (
          <div
            key={row.blockedId}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
          >
            <Link href={`/u/${row.blocked.username}`} className="shrink-0">
              {row.blocked.avatarUrl ? (
                <Image
                  src={row.blocked.avatarUrl}
                  alt={row.blocked.fullName}
                  width={44}
                  height={44}
                  unoptimized
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="grad-hero grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white">
                  {(row.blocked.fullName[0] ?? '?').toUpperCase()}
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{row.blocked.fullName}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                @{row.blocked.username} · {timeAgo(row.createdAt)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                unblock.mutate(row.blockedId, {
                  onSuccess: () => toast.success(t('block.unblocked')),
                })
              }
              disabled={unblock.isPending}
            >
              {t('block.unblock')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
