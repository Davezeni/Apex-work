'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type HomeConfig = {
  heroBadge: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;
  searchPlaceholder: string;
  stats: { value: string; label: string }[];
  howItWorks: { title: string; description: string }[];
  featured: {
    name: string;
    title: string;
    city: string;
    rating: string;
    reviews: number;
    skills: string[];
    price: number;
    gradient: string;
  }[];
  pricingClient: { heading: string; price: string; description: string; cta: string };
  pricingFreelancer: { heading: string; price: string; description: string; cta: string };
  cta: { title: string; subtitle: string; primary: string; secondary: string };
};

/** Fetch the admin-managed home / landing-page marketing copy (cached). */
export function useHomeConfig() {
  return useQuery<HomeConfig>({
    queryKey: ['content', 'home'],
    queryFn: () => apiFetch<HomeConfig>('/content/home'),
    staleTime: 5 * 60 * 1000,
  });
}
