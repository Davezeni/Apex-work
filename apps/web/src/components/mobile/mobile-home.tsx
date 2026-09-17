'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import {
  Search,
  Bookmark,
  Star,
  MapPin,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';
import { useGigs, type GigListItem } from '@/hooks/use-gigs';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { useSavedGigs, useSaveGig, useUnsaveGig } from '@/hooks/use-saved-gigs';
import { useAuthStore } from '@/stores/auth-store';
import { useRecommendations, type RecommendedJob } from '@/hooks/use-recommendations';
import { RecentlyViewedRow } from '@/components/home/recently-viewed';
import { toast } from 'sonner';
import { NotificationsPanel } from '@/components/notifications-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { VoiceSearch } from '@/components/chat/voice-search';
import { gradientFor } from '@/components/ui/avatar-gradient';
import { UserAvatar } from '@/components/ui/user-avatar';
/** Deterministic pick so a user's avatar color stays stable across renders. */

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export function MobileHome() {
  const [activeCategory, setActiveCategory] = useState<string>('for-you');
  const { data: me } = useMe();
  const { t } = useI18n();
  const router = useRouter();
  const { data: savedData } = useSavedGigs();
  const savedSlugs = new Set(savedData?.items.map((item) => item.gig.slug) ?? []);
  const { data: gigsData, isLoading } = useGigs({
    category: activeCategory !== 'for-you' ? activeCategory : undefined,
    limit: 20,
  });
  const recommendations = useRecommendations();

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
        <div className="flex items-center gap-1.5 md:mr-14">
          <NotificationsPanel />
          {/* Mobile theme toggle — desktop gets the single shell-level one. */}
          <div className="md:hidden">
            <ThemeToggle />
          </div>
          <Link href="/profile" className="grid h-10 w-10 place-items-center">
            {me ? (
              <UserAvatar
                name={me.fullName}
                avatarUrl={me.avatarUrl}
                id={me.id}
                className="h-10 w-10 text-sm font-bold"
              />
            ) : (
              <span className="grad-hero grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white">
                A
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Search */}
      <div className="px-5 pb-4">
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-2 pl-4 text-sm text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <Link href="/search" className="flex-1 truncate">
            {t('home.searchPlaceholder')}
          </Link>
          <VoiceSearch
            size="sm"
            onResult={(txt) => router.push(`/search?q=${encodeURIComponent(txt)}`)}
          />
        </div>
      </div>

      {/* Device-local recently viewed gigs (shown only when present) */}
      <RecentlyViewedRow />

      {/* Jobs + Nearby shortcuts */}
      <div className="mb-5 grid grid-cols-2 gap-2 px-5">
        <Link
          href="/jobs"
          className="flex flex-col items-start gap-1 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-3 transition-transform active:scale-[0.98]"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/20 text-xl">
            📢
          </div>
          <div className="text-xs font-extrabold">{t('jobs.title')}</div>
          <div className="line-clamp-1 text-[10px] text-muted-foreground">{t('jobs.subtitle')}</div>
        </Link>
        <Link
          href="/nearby"
          className="flex flex-col items-start gap-1 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-violet-500/10 p-3 transition-transform active:scale-[0.98]"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-xl">🗺</div>
          <div className="text-xs font-extrabold">{t('home.nearby')}</div>
          <div className="line-clamp-1 text-[10px] text-muted-foreground">
            {t('home.nearbySub')}
          </div>
        </Link>
      </div>

      {me?.role === 'FREELANCER' &&
        recommendations.data?.kind === 'jobs' &&
        recommendations.data.items.length > 0 && (
          <RecommendedJobsSection
            items={recommendations.data.items}
            basedOn={recommendations.data.basedOn}
          />
        )}

      {/* Category chips */}
      <div className="mb-4 flex items-center justify-between px-5">
        <h2 className="text-base font-bold tracking-tight">{t('home.explore')}</h2>
        <Link href="/browse" className="text-xs font-semibold text-primary">
          {t('home.seeAll')}
        </Link>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-6">
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
          <GigCard key={g.id} g={g} saved={savedSlugs.has(g.slug)} />
        ))}
      </div>
    </div>
  );
}

function RecommendedJobsSection({
  items,
  basedOn,
}: {
  items: RecommendedJob[];
  basedOn: string[];
}) {
  return (
    <section className="mb-5">
      <div className="mb-3 flex items-center justify-between px-5">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold tracking-tight">
            <Sparkles className="h-4 w-4 text-primary" /> Jobs picked for you
          </h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Based on {basedOn.slice(0, 3).join(', ') || 'your profile'}
          </p>
        </div>
        <Link href="/jobs" className="text-xs font-semibold text-primary">
          See all
        </Link>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
        {items.slice(0, 5).map((job) => (
          <RecommendedJobCard key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
}

function RecommendedJobCard({ job }: { job: RecommendedJob }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block w-72 shrink-0 rounded-2xl border border-border bg-card p-4 transition-transform active:scale-[.98]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-600">
          {job.matchScore}% match
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-bold">{job.title}</h3>
      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {job.description}
      </p>
      {/* Client identity on the job card */}
      <div className="mt-2 flex items-center gap-1.5">
        <div className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
          {job.client?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.client.avatarUrl}
              alt={job.client.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            (job.client?.fullName ?? '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <span className="truncate text-[10px] text-muted-foreground">
          {job.client?.fullName ?? 'Client'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
        <span className="font-semibold">
          {job.budgetMinEtb || job.budgetMaxEtb
            ? `${job.budgetMinEtb ?? '—'}–${job.budgetMaxEtb ?? '—'} ETB`
            : 'Budget negotiable'}
        </span>
        <span className="text-muted-foreground">{job.isRemote ? 'Remote' : 'On-site'}</span>
      </div>
      {job.matchedSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.matchedSkills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </Link>
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

function GigCard({ g, saved }: { g: GigListItem; saved: boolean }) {
  // Two layouts:
  //   - IMAGE cover  → traditional hero (200px image, avatar row below)
  //   - NO cover     → compact card, no giant gradient block. Avatar +
  //     freelancer info sit on the top row, title + price below.
  if (!g.coverImageUrl) return <NoCoverGigCard g={g} saved={saved} />;
  return <ImageGigCard g={g} saved={saved} />;
}

/** Card variant used when the gig has a real image. */
function ImageGigCard({ g, saved }: { g: GigListItem; saved: boolean }) {
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="block overflow-hidden rounded-2xl border border-border bg-card transition-transform active:scale-[.98]"
    >
      <div className="relative aspect-[16/9] w-full bg-muted">
        <Image
          src={g.coverImageUrl!}
          alt={g.title}
          fill
          unoptimized
          sizes="400px"
          className="object-cover"
        />
        {g.isFeatured ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-black shadow">
            ⚡ Featured
          </span>
        ) : g.rating >= 4.8 && g.ratingCount >= 10 ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
            🔥 Top Rated
          </span>
        ) : null}
        <HomeSaveButton slug={g.slug} saved={saved} />
      </div>
      <CardBody g={g} />
    </Link>
  );
}

/** Compact card variant used when the gig has no cover image. No hero. */
function NoCoverGigCard({ g, saved }: { g: GigListItem; saved: boolean }) {
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="block overflow-hidden rounded-2xl border border-border bg-card transition-transform active:scale-[.98]"
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            'grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br text-base font-bold text-white',
            gradientFor(g.owner.id),
          )}
        >
          {g.owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={g.owner.avatarUrl}
              alt={g.owner.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            initialsOf(g.owner.fullName)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-bold">{g.owner.fullName}</h3>
            {g.owner.isVerified && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" />}
            {g.isFeatured && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-black">
                ⚡ Featured
              </span>
            )}
            {!g.isFeatured && g.rating >= 4.8 && g.ratingCount >= 10 && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                🔥 Top Rated
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">@{g.owner.username}</p>
        </div>
        <HomeSaveButton slug={g.slug} saved={saved} compact />
      </div>
      <CardBody g={g} noTopPadding />
    </Link>
  );
}

function HomeSaveButton({
  slug,
  saved,
  compact = false,
}: {
  slug: string;
  saved: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const token = useAuthStore((state) => state.accessToken);
  const { t } = useI18n();
  const save = useSaveGig();
  const unsave = useUnsaveGig();
  const busy = save.isPending || unsave.isPending;
  const [localSaved, setLocalSaved] = useState(saved);

  useEffect(() => {
    if (!busy) setLocalSaved(saved);
  }, [saved, busy]);

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (!token) {
      router.push(`/login?next=${encodeURIComponent(`/gigs/${slug}`)}`);
      return;
    }
    const nextSaved = !localSaved;
    setLocalSaved(nextSaved);
    const mutation = nextSaved ? save : unsave;
    mutation.mutate(slug, {
      onSuccess: () => toast.success(nextSaved ? t('gigs.saved') : t('gigs.removedSaved')),
      onError: (error) => {
        setLocalSaved(!nextSaved);
        toast.error(error.message);
      },
    });
  };

  return (
    <button
      type="button"
      aria-label={localSaved ? 'Remove gig from saved' : 'Save gig'}
      aria-pressed={localSaved}
      disabled={busy}
      onClick={onClick}
      className={cn(
        compact
          ? 'grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted'
          : 'absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur',
        'z-10 disabled:opacity-60',
        localSaved && (compact ? 'bg-primary/10 text-primary' : 'text-pink-200'),
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bookmark className="h-4 w-4" fill={localSaved ? 'currentColor' : 'none'} />
      )}
    </button>
  );
}

/** Shared bottom half of both card variants. */
function CardBody({ g, noTopPadding = false }: { g: GigListItem; noTopPadding?: boolean }) {
  return (
    <div className={cn('px-4 pb-4', noTopPadding ? 'pt-0' : 'pt-3')}>
      {/* Owner identity — the freelancer behind the gig, on every card. */}
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full text-[9px] font-bold text-white',
            gradientFor(g.owner.id),
          )}
        >
          {g.owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={g.owner.avatarUrl}
              alt={g.owner.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            initialsOf(g.owner.fullName)
          )}
        </div>
        <span className="truncate text-[11px] font-semibold">{g.owner.fullName}</span>
        {g.owner.isVerified && (
          <CheckCircle2 className="h-3 w-3 shrink-0 fill-cyan-400 text-white" />
        )}
        <span className="truncate text-[10px] text-muted-foreground">@{g.owner.username}</span>
      </div>
      <div className="line-clamp-2 text-sm font-semibold leading-snug">{g.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {g.ratingCount > 0 ? (
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{g.rating.toFixed(2)}</span>
            <span>({g.ratingCount})</span>
          </span>
        ) : (
          <span className="text-muted-foreground/60">{dt('New')}</span>
        )}
        {g.owner.city && (
          <>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {g.owner.city}
            </span>
          </>
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
