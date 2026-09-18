'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'CLIENT' | 'FREELANCER' | 'ADMIN';
  title: string | null;
  bio: string | null;
  city: string | null;
  country: string;
  hourlyRateEtb: number | null;
  languages: string[];
  isVerified: boolean;
  agencyMemberships?: { agency: { name: string; slug: string } }[];
  isPro?: boolean;
  rating: number;
  ratingCount: number;
  completedOrders: number;
  createdAt: string;
  skills: { id: string; name: string; slug: string }[];
  gigs: {
    id: string;
    title: string;
    slug: string;
    coverImageUrl: string | null;
    categoryId: string;
    rating: number;
    ratingCount: number;
    startingPriceEtb: number;
  }[];
  portfolio: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string;
    externalUrl: string | null;
    role: string | null;
    tools: string[];
    outcome: string | null;
    tags: string[];
    featured: boolean;
  }[];
}

export function usePublicUser(username: string | undefined) {
  return useQuery<PublicUser>({
    queryKey: ['public-user', username],
    queryFn: () => apiFetch(`/users/${username}`),
    enabled: !!username,
    staleTime: 60 * 1000,
  });
}
