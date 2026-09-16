'use client';

import { dt } from '@/i18n/auto';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2, Search as SearchIcon, Trash2, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useSavedSearches,
  useUpdateSavedSearch,
  useDeleteSavedSearch,
} from '@/hooks/use-saved-searches';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
export default function SavedSearchesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data, isLoading } = useSavedSearches();
  const update = useUpdateSavedSearch();
  const remove = useDeleteSavedSearch();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/settings/saved-searches');
  }, [meLoading, isAuthed, router]);

  if (isLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

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
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">{dt('Saved searches')}</h1>
          <div className="text-[10px] text-muted-foreground">
            {dt('Get pinged when new matches appear')}
          </div>
        </div>
      </header>

      {items.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <SearchIcon className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-semibold">{dt('No saved searches yet')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run a search anywhere in Apex-Work, tap &ldquo;Save&rdquo;, and we&rsquo;ll notify you
            when fresh matches show up.
          </p>
          <Button asChild variant="brand" size="sm" className="mt-4">
            <Link href="/search">{dt('Try a search')}</Link>
          </Button>
        </div>
      )}

      <div className="mx-3 mt-4 space-y-2">
        {items.map((s) => {
          const url =
            s.type === 'GIGS'
              ? `/browse?q=${encodeURIComponent(s.query)}`
              : s.type === 'JOBS'
                ? `/jobs?q=${encodeURIComponent(s.query)}`
                : `/search?q=${encodeURIComponent(s.query)}`;
          return (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <SearchIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={url} className="text-sm font-bold hover:underline">
                    {s.name}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">
                    {s.type.toLowerCase()} · &ldquo;{s.query}&rdquo;
                    {s.category && ` · ${s.category}`}
                    {' · '}checked {timeAgo(s.lastCheckedAt)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    update.mutate({
                      id: s.id,
                      pushEnabled: !s.pushEnabled,
                      emailEnabled: !s.pushEnabled,
                    })
                  }
                  aria-label={s.pushEnabled ? 'Mute' : 'Unmute'}
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:bg-muted"
                  title={s.pushEnabled ? 'Notifications on' : 'Notifications off'}
                >
                  {s.pushEnabled ? (
                    <Bell className="h-4 w-4 text-primary" />
                  ) : (
                    <BellOff className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this saved search?'))
                      remove.mutate(s.id, { onSuccess: () => toast.success(dt('Deleted')) });
                  }}
                  aria-label={dt('Delete')}
                  className="grid h-9 w-9 place-items-center rounded-full text-red-500 active:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
