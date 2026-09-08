'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface GigListItem {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  categoryId: string;
  rating: number;
  ratingCount: number;
  startingPriceEtb: number;
  isFeatured?: boolean;
  owner: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    city: string | null;
    isVerified?: boolean;
  };
}

export interface GigDetail extends GigListItem {
  description: string;
  tags: string[];
  galleryUrls: string[];
  ordersCount: number;
  viewsCount: number;
  createdAt: string;
  packages: {
    id: string;
    tier: 'BASIC' | 'STANDARD' | 'PREMIUM';
    title: string;
    description: string;
    priceEtb: number;
    deliveryDays: number;
    revisions: number;
  }[];
  owner: GigListItem['owner'] & {
    bio: string | null;
    rating: number;
    ratingCount: number;
    completedOrders: number;
    isVerified?: boolean;
    isPhoneVerified?: boolean;
    isIdVerified?: boolean;
  };
}

/** Public gig list, cursor-paginated. */
export function useGigs(
  params: { category?: string; q?: string; limit?: number; cursor?: string | null } = {},
) {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.q) search.set('q', params.q);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.cursor) search.set('cursor', params.cursor);
  const qs = search.toString();

  return useQuery<{ items: GigListItem[]; nextCursor: string | null; hasMore: boolean }>({
    queryKey: ['gigs', params],
    queryFn: () => apiFetch(`/gigs${qs ? `?${qs}` : ''}`),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000, // Matches API cache TTL — no wasted refetches.
    gcTime: 5 * 60 * 1000,
  });
}

/** Single gig detail by slug. */
export function useGig(slug: string | undefined) {
  return useQuery<GigDetail>({
    queryKey: ['gig', slug],
    queryFn: () => apiFetch(`/gigs/${slug}`),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });
}
