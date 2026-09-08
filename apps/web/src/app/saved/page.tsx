'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, CheckCircle2, ChevronRight, Heart, Loader2, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@apex-work/shared';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { useMe } from '@/hooks/use-me';
import { useSavedGigs, useUnsaveGig, type SavedGig } from '@/hooks/use-saved-gigs';
import { cn, formatEtb } from '@/lib/utils';
import { useI18n } from '@/i18n';

export default function SavedGigsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading: meLoading } = useMe();
  const saved = useSavedGigs();
  const remove = useUnsaveGig();

  useEffect(() => {
    if (!meLoading && !me) router.replace('/login?next=/saved');
  }, [meLoading, me, router]);

  if (meLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = saved.data?.items ?? [];

  return (
    <MobileShell activeTab="search">
      <div className="min-h-dvh bg-background pb-24">
        <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
          <button
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">Saved gigs</h1>
            <p className="text-[11px] text-muted-foreground">
              {saved.isLoading
                ? 'Loading…'
                : `${items.length} saved ${items.length === 1 ? 'gig' : 'gigs'}`}
            </p>
          </div>
          <Bookmark className="h-5 w-5 text-primary" fill="currentColor" />
        </header>

        {saved.isLoading && (
          <div className="grid h-48 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {saved.error && !saved.isLoading && (
          <div className="mx-4 mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center">
            <p className="text-sm font-semibold">Could not load saved gigs</p>
            <p className="mt-1 text-xs text-muted-foreground">{saved.error.message}</p>
            <button
              onClick={() => void saved.refetch()}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!saved.isLoading && !saved.error && items.length === 0 && (
          <div className="mx-4 mt-10 rounded-3xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Heart className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-base font-extrabold">No saved gigs yet</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tap the heart on a gig you like and it will stay here across your devices.
            </p>
            <Link
              href="/browse"
              className="mt-5 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white"
            >
              Browse gigs <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {!saved.isLoading && !saved.error && items.length > 0 && (
          <div className="mx-3 mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <SavedGigCard
                key={item.id}
                item={item}
                busy={remove.isPending}
                onRemove={() => {
                  remove.mutate(item.gig.slug, {
                    onSuccess: () => toast.success('Gig removed from saved'),
                    onError: (error) => toast.error(error.message),
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function SavedGigCard({
  item,
  busy,
  onRemove,
}: {
  item: SavedGig;
  busy: boolean;
  onRemove: () => void;
}) {
  const { gig } = item;
  const category = CATEGORIES.find((entry) => entry.id === gig.categoryId);
  const unavailable = gig.status !== 'ACTIVE';

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card',
        unavailable && 'opacity-75',
      )}
    >
      <Link href={`/gigs/${gig.slug}`} className="block active:bg-muted/40">
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/30 via-primary/15 to-primary/10">
          {gig.coverImageUrl ? (
            <Image
              src={gig.coverImageUrl}
              alt={gig.title}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-background/70 text-xl font-extrabold text-primary backdrop-blur">
                {gig.title.slice(0, 1).toUpperCase()}
              </div>
            </div>
          )}
          {unavailable && (
            <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white">
              Currently unavailable
            </span>
          )}
          <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
            <Bookmark className="h-4 w-4" fill="currentColor" />
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>
              {category?.icon ?? '💼'} {category?.label ?? 'Service'}
            </span>
            {gig.owner.city && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {gig.owner.city}
                </span>
              </>
            )}
          </div>
          <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-snug">{gig.title}</h2>
          <div className="mt-2 flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-[10px] font-extrabold text-primary">
              {gig.owner.fullName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 truncate text-[11px] font-semibold">
                {gig.owner.fullName}
                <CheckCircle2 className="h-3 w-3 shrink-0 text-cyan-500" />
              </div>
              <div className="text-[10px] text-muted-foreground">@{gig.owner.username}</div>
            </div>
            {gig.ratingCount > 0 && (
              <span className="text-[10px] font-semibold text-amber-500">
                ★ {gig.rating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <span className="text-[10px] text-muted-foreground">Starting at</span>
            <span className="text-sm font-extrabold text-primary">
              {formatEtb(gig.startingPriceEtb)}
            </span>
          </div>
        </div>
      </Link>
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={onRemove}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Remove from saved
        </button>
      </div>
    </article>
  );
}
