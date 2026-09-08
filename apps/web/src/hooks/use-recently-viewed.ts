'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'apex:recently-viewed';
const MAX = 8;

export interface RecentlyViewedGig {
  slug: string;
  title: string;
  coverImageUrl?: string | null;
  startingPriceEtb: number;
  ownerUsername?: string | null;
  ownerName?: string | null;
  rating?: number;
  ratingCount?: number;
  viewedAt: number;
}

function read(): RecentlyViewedGig[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecentlyViewedGig[]).slice(0, MAX);
  } catch {
    return [];
  }
}

function write(list: RecentlyViewedGig[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore storage quota / private-mode errors
  }
}

/** Record a gig as recently-viewed by the current visitor (device-local). */
export function useTrackRecentlyViewed() {
  return useCallback((gig: Omit<RecentlyViewedGig, 'viewedAt'>) => {
    const list = read().filter((g) => g.slug !== gig.slug);
    list.unshift({ ...gig, viewedAt: Date.now() });
    write(list);
  }, []);
}

/** The list of recently-viewed gigs (device-local), deduped, newest first. */
export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedGig[]>([]);

  useEffect(() => {
    setItems(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const clear = useCallback(() => {
    write([]);
    setItems([]);
  }, []);

  return { items, clear };
}
