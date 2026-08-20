'use client';

import { useState } from 'react';
import { Search, Bell, Mic, Bookmark, Star, MapPin, CheckCircle2, Flame } from 'lucide-react';
import Link from 'next/link';
import { CATEGORIES } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';

const stories = [
  { id: 'you', name: 'Your story', initials: '+', add: true },
  { id: 'dt', name: 'Dawit', initials: 'DT', gradient: 'from-violet-500 to-emerald-500' },
  { id: 'hw', name: 'Hanna', initials: 'HW', gradient: 'from-cyan-500 to-violet-500' },
  { id: 'mb', name: 'Meron', initials: 'MB', gradient: 'from-amber-500 to-red-500' },
  { id: 'ak', name: 'Abel', initials: 'AK', gradient: 'from-emerald-500 to-amber-500' },
  { id: 'tg', name: 'Tsion', initials: 'TG', gradient: 'from-red-500 to-violet-500' },
];

const feed = [
  {
    id: 'g1',
    slug: 'modern-saas-landing-page-design',
    badge: { icon: Flame, label: 'Top Rated', color: 'text-orange-400' },
    coverGradient: 'from-violet-500 via-emerald-500 to-amber-400',
    owner: { name: 'Selam Assefa', title: 'Senior UI/UX Designer', initials: 'SA', gradient: 'from-violet-500 to-emerald-500' },
    title: 'I will design a modern SaaS landing page in 48h',
    rating: 4.98,
    reviews: 312,
    city: 'Addis Ababa',
    online: true,
    price: 2500,
  },
  {
    id: 'g2',
    slug: 'nextjs-mvp-full-stack',
    badge: { icon: Flame, label: 'Fast delivery', color: 'text-amber-400' },
    coverGradient: 'from-amber-500 via-red-500 to-violet-500',
    owner: { name: 'Dawit Tesfaye', title: 'Full-Stack Developer', initials: 'DT', gradient: 'from-amber-500 to-red-500' },
    title: 'I will build your MVP with Next.js and PostgreSQL',
    rating: 5.0,
    reviews: 198,
    city: 'Bahir Dar',
    online: false,
    price: 4800,
  },
];

export function MobileHome() {
  const [activeCategory, setActiveCategory] = useState<string>('for-you');

  return (
    <div className="min-h-dvh">
      {/* Sticky header */}
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between bg-background/85 px-5 pb-3 pt-4 backdrop-blur-xl">
        <div>
          <div className="text-xs text-muted-foreground">ጤና ይስጥልኝ 👋</div>
          <h1 className="text-2xl font-extrabold tracking-tight">Selamawit</h1>
        </div>
        <div className="flex gap-2">
          <button
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card active:scale-95"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background bg-destructive" />
          </button>
          <div className="grad-hero grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white">
            S
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="px-5 pb-4">
        <Link
          href="/search"
          className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm text-muted-foreground"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1">Search freelancers, gigs, skills…</span>
          <button
            aria-label="Voice search"
            className="grad-hero grid h-9 w-9 place-items-center rounded-xl text-white"
            onClick={(e) => e.preventDefault()}
          >
            <Mic className="h-4 w-4" />
          </button>
        </Link>
      </div>

      {/* Stories */}
      <div className="flex gap-3 overflow-x-auto px-5 pb-5 no-scrollbar">
        {stories.map((s) => (
          <button key={s.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <div
              className={cn(
                'grad-hero grid h-16 w-16 place-items-center rounded-full p-[3px]',
                s.add && 'bg-none border-2 border-dashed border-border',
              )}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-background p-0.5">
                <div
                  className={cn(
                    'grid h-full w-full place-items-center rounded-full text-sm font-bold text-white bg-gradient-to-br',
                    s.gradient ?? 'from-primary to-accent',
                    s.add && 'bg-card bg-none text-primary text-2xl font-light',
                  )}
                >
                  {s.initials}
                </div>
              </div>
            </div>
            <span className="w-16 truncate text-center text-[11px] text-muted-foreground">{s.name}</span>
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="mb-4 flex items-center justify-between px-5">
        <h2 className="text-base font-bold tracking-tight">Explore</h2>
        <Link href="/browse" className="text-xs font-semibold text-primary">
          See all
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto px-5 pb-6 no-scrollbar">
        <CategoryChip
          label="✨ For you"
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
        <h2 className="text-base font-bold tracking-tight">Top talent nearby</h2>
        <Link href="/browse" className="text-xs font-semibold text-primary">
          View all
        </Link>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-8">
        {feed.map((g) => (
          <GigCard key={g.id} g={g} />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function GigCard({ g }: { g: (typeof feed)[number] }) {
  const BadgeIcon = g.badge.icon;
  return (
    <Link
      href={`/gigs/${g.slug}`}
      className="overflow-hidden rounded-2xl border border-border bg-card transition-transform active:scale-[.98]"
    >
      <div className={cn('relative h-32 bg-gradient-to-br', g.coverGradient)}>
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
          <BadgeIcon className={cn('h-3 w-3', g.badge.color)} />
          {g.badge.label}
        </span>
        <button
          aria-label="Save"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          onClick={(e) => {
            e.preventDefault();
          }}
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="-mt-10 flex items-end gap-3">
          <div
            className={cn(
              'grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br text-base font-bold text-white ring-4 ring-card',
              g.owner.gradient,
            )}
          >
            {g.owner.initials}
          </div>
          <div className="pb-1">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              {g.owner.name}
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            </h3>
            <p className="text-[11px] text-muted-foreground">{g.owner.title}</p>
          </div>
        </div>
        <div className="mt-3 text-sm font-semibold leading-snug">{g.title}</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{g.rating}</span> ({g.reviews})
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {g.city}
          </span>
          {g.online && (
            <>
              <span>·</span>
              <span className="text-emerald-400">🟢 Online</span>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="text-[11px] text-muted-foreground">
            From <span className="text-base font-extrabold text-foreground">{formatEtb(g.price)}</span>
          </div>
          <span className="grad-hero rounded-full px-4 py-1.5 text-xs font-bold text-white">Hire now</span>
        </div>
      </div>
    </Link>
  );
}
