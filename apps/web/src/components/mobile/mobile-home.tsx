'use client';

import { useState } from 'react';
import { Search, Bookmark, Star, MapPin, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';
import { useGigs, type GigListItem } from '@/hooks/use-gigs';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { NotificationsBell } from '@/components/notifications-bell';
import { Skeleton } from '@/components/ui/skeleton';
import { VoiceSearch } from '@/components/chat/voice-search';

const AVATAR_GRADIENTS = [
  'from-violet-500 to-emerald-500',
  'from-amber-500 to-red-500',
  'from-cyan-500 to-violet-500',
  'from-emerald-500 to-amber-500',
  'from-red-500 to-violet-500',
];

/** Deterministic pick so a user's avatar color stays stable across renders. */
function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]!;
}

function initialsOf(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function MobileHome() {
  const [activeCategory, setActiveCategory] = useState<string>('for-you');
  const { data: me } = useMe();
  const { t } = useI18n();
  const router = useRouter();
  const { data: gigsData, isLoading } = useGigs({
    category: activeCategory !== 'for-you' ? activeCategory : undefined,
    limit: 20,
  });

  const gigs = gigsData?.items ?? [];
  const firstName = me?.fullName.split(' ')[0] ?? t('nav.home');

  return (
    <div className="min-h-dvh">
      {/* Sticky header */}
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between bg-background/85 px-5 pb-3 pt-4 backdrop-blur-xl">
        <div>
          <div className="text-xs text-muted-foreground">
            {me ? t('home.greeting') : t('home.greetingGuest')}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{firstName}</h1>
        </div>
        <div className="flex gap-2">
          <NotificationsBell />
          <Link
            href="/profile"
            className={cn(
              'grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white',
              me ? `bg-gradient-to-br ${gradientFor(me.id)}` : 'grad-hero',
            )}
          >
            {me ? initialsOf(me.fullName)[0] : 'A'}
          </Link>
        </div>
      </header>

      {/* Search */}
      <div className="px-5 pb-4">
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-2 pl-4 text-sm text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <Link href="/search" className="flex-1 truncate">{t('home.searchPlaceholder')}</Link>
          <VoiceSearch size="sm" onResult={(txt) => router.push(`/search?q=${encodeURIComponent(txt)}`)} />
        </div>
      </div>

      {/* Jobs + Nearby shortcuts */}
      <div className="mb-5 grid grid-cols-2 gap-2 px-5">
        <Link
          href="/jobs"
          className="flex flex-col items-start gap-1 rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-primary/10 p-3 transition-transform active:scale-[0.98]"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/20 text-xl">📢</div>
          <div className="text-xs font-extrabold">{t('jobs.title')}</div>
          <div className="text-[10px] text-muted-foreground line-clamp-1">{t('jobs.subtitle')}</div>
        </Link>
        <Link
          href="/nearby"
          className="flex flex-col items-start gap-1 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-violet-500/10 p-3 transition-transform active:scale-[0.98]"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-xl">🗺</div>
          <div className="text-xs font-extrabold">Nearby</div>
          <div className="text-[10px] text-muted-foreground line-clamp-1">Freelancers near you</div>
        </Link>
      </div>

      {/* Category chips */}
      <div className="mb-4 flex items-center justify-between px-5">
        <h2 className="text-base font-bold tracking-tight">{t('home.explore')}</h2>
        <Link href="/browse" className="text-xs font-semibold text-primary">
          {t('home.seeAll')}
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto px-5 pb-6 no-scrollbar">
        <CategoryChip
          label={t('home.forYou')}
          active={activeCategory === 'for-you'}
          onClick={() => setActiveCategory('for-you')}
        />
        {CATEGORIES.map((c) => (
          <CategoryChip
            key={c.id}
            label={`${c.icon} ${c.label}`}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
          />
        ))}
      </div>

      {/* Feed */}
      <div className="mb-4 flex items-center justify-between px-5">
        <h2 className="text-base font-bold tracking-tight">{t('home.topTalent')}</h2>
        <Link href="/browse" className="text-xs font-semibold text-primary">
          {t('home.viewAll')}
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-5 pb-8">
        {isLoading && (
          <>
            <GigSkeleton />
            <GigSkeleton />
            <GigSkeleton />
          </>
        )}
        {!isLoading && gigs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="text-2xl">🌱</div>
            <p className="mt-2 text-sm font-semibold">{t('home.noGigsInCategory')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('home.postFirst')}</p>
          </div>
        )}
        {gigs.map((g) => (
          <GigCard key={g.id} g={g} />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-all active:scale-95',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/40'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      {label}
    </button>
  );
}

function GigCard({ g }: { g: GigListItem }) {
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="overflow-hidden rounded-2xl border border-border bg-card transition-transform active:scale-[.98]"
    >
      {/* Compact hero — 88px keeps the ratio pleasant when no cover image. */}
      <div className={cn('relative h-24 bg-gradient-to-br', gradientFor(g.id))}>
        {g.coverImageUrl && (
          <Image src={g.coverImageUrl} alt={g.title} fill unoptimized sizes="400px" className="object-cover" />
        )}
        {!g.coverImageUrl && (
          <div className="pointer-events-none absolute inset-0 opacity-25"
               style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 70%, white 0%, transparent 40%)' }} />
        )}
        {g.isFeatured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-black shadow">
            ⚡ Featured
          </span>
        )}
        {!g.isFeatured && g.rating >= 4.8 && g.ratingCount >= 10 && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
            🔥 Top Rated
          </span>
        )}
        <button
          aria-label="Save"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          onClick={(e) => e.preventDefault()}
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="-mt-8 flex items-end gap-3">
          <div
            className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white ring-4 ring-card',
              gradientFor(g.owner.id),
            )}
          >
            {initialsOf(g.owner.fullName)}
          </div>
          <div className="min-w-0 pb-1">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <span className="truncate">{g.owner.fullName}</span>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            </h3>
            <p className="truncate text-[11px] text-muted-foreground">@{g.owner.username}</p>
          </div>
        </div>
        <div className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{g.title}</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {g.ratingCount > 0 ? (
            <>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-foreground">{g.rating.toFixed(2)}</span> (
                {g.ratingCount})
              </span>
              {g.owner.city && <span>·</span>}
            </>
          ) : (
            <span className="text-muted-foreground/60">New freelancer</span>
          )}
          {g.owner.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {g.owner.city}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="text-[11px] text-muted-foreground">
            From{' '}
            <span className="text-base font-extrabold text-foreground">
              {formatEtb(g.startingPriceEtb)}
            </span>
          </div>
          <span className="grad-hero rounded-full px-4 py-1.5 text-xs font-bold text-white">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Skeleton placeholder that mirrors the shape of GigCard so the layout
 * doesn't jump when real data arrives. Uses fixed heights matching the
 * actual card so CLS stays at zero.
 */
function GigSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-4">
        <div className="-mt-10 flex items-end gap-3">
          <Skeleton className="h-14 w-14 rounded-full ring-4 ring-card" />
          <div className="flex-1 pb-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
        </div>
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-3/4" />
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}
