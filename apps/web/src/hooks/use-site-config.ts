'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type SiteConfig = {
  brandName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  supportTelegram: string;
  privacyEmail: string;
  legalEmail: string;
};

/** Fetch the admin-managed brand + contact config (public, cached). */
export function useSiteConfig() {
  return useQuery<SiteConfig>({
    queryKey: ['content', 'site'],
    queryFn: () => apiFetch<SiteConfig>('/content/site'),
    staleTime: 5 * 60 * 1000,
    placeholderData: {
      brandName: 'Apex-Work',
      tagline: 'Ethiopia\u2019s freelance marketplace',
      supportEmail: 'support@apex-work.com',
      supportPhone: '+251911000000',
      supportTelegram: 'https://t.me/apex_work_support',
      privacyEmail: 'privacy@apex-work.com',
      legalEmail: 'legal@apex-work.com',
    },
  });
}
