'use client';

import { MobileShell } from '@/components/mobile/mobile-shell';
import { Search, Mic, Clock, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const RECENT = [
  { q: 'Amharic translator', results: '128 freelancers' },
  { q: 'React developer Addis', results: '42 gigs match' },
  { q: 'Logo design', results: '210 gigs match' },
];
const TRENDING = ['🔥 Wedding video', '🔥 TikTok editor', '🔥 Shopify setup', '🔥 CV writing', '🔥 Voice over'];

export default function SearchPage() {
  const [tab, setTab] = useState<'all' | 'freelancers' | 'gigs' | 'jobs'>('all');
  return (
    <MobileShell activeTab="search">
      <header className="safe-top px-5 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Search</h1>
      </header>

      <div className="px-5 pb-4">
        <div className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search anything…"
          />
          <button aria-label="Voice" className="grad-hero grid h-9 w-9 place-items-center rounded-xl text-white">
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 px-5 pb-4">
        {(['all', 'freelancers', 'gigs', 'jobs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-full border px-3 py-2 text-xs font-semibold capitalize',
              tab === t ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-5 pb-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent</h2>
        <div className="divide-y divide-border">
          {RECENT.map((r) => (
            <button key={r.q} className="flex w-full items-center gap-3 py-3 text-left">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-card text-muted-foreground">
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.q}</div>
                <div className="text-xs text-muted-foreground">{r.results}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-8">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Trending
        </h2>
        <div className="flex flex-wrap gap-2">
          {TRENDING.map((t) => (
            <button key={t} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
              {t}
            </button>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}
